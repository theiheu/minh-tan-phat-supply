-- 0083_defect_repair_rpcs.sql
-- Modernize defect, repair, exchange, and liquidation RPCs to use the canonical posting kernel

-- 1. record_defect
create or replace function public.record_defect(p_items jsonb, p_source_loc uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;

  insert into public.defect_notes (code, source_location_id, reported_by)
  values (public.next_code('HONG', 'public.defect_notes_seq'::regclass), p_source_loc, p_by)
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.defect_note_items
      (defect_note_id, variant_id, quantity, entered_quantity, damage_detail, damage_type, severity, images, unit_cost, note)
    values (
      v_id,
      coalesce((it.value->>'sku_id')::uuid, (it.value->>'variant_id')::uuid),
      (it.value->>'quantity')::int,
      coalesce((it.value->>'entered_quantity')::numeric, (it.value->>'quantity')::numeric),
      it.value->>'damage_detail',
      nullif(it.value->>'damage_type','')::public.damage_type,
      nullif(it.value->>'severity','')::public.severity_level,
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(it.value->'images','[]'::jsonb)) as x), '{}'),
      nullif(it.value->>'unit_cost','')::numeric,
      nullif(btrim(it.value->>'note',''),'')
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.record', 'defect', v_id, jsonb_build_object('status','staging'));
  return v_id;
end;
$$;

-- 2. create_exchange
create or replace function public.create_exchange(p_defect_id uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_status public.defect_status;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status into v_status from public.defect_notes where id = p_defect_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu hỏng'; end if;
  if v_status <> 'staging' then raise exception 'Chỉ tạo đổi mới cho phiếu hỏng đang tập kết (hiện tại: %)', v_status; end if;

  if exists (select 1 from public.exchange_notes where linked_defect_id = p_defect_id and status in ('pending','approved','issued','received')) then
    raise exception 'Phiếu hỏng này đã có phiếu Đổi Mới đang xử lý';
  end if;

  insert into public.exchange_notes (code, linked_defect_id, created_by)
  values (public.next_code('DM', 'public.exchange_notes_seq'::regclass), p_defect_id, p_by)
  returning id into v_id;

  for it in select dni.* from public.defect_note_items dni where dni.defect_note_id = p_defect_id order by dni.id loop
    insert into public.exchange_note_items (exchange_note_id, variant_id, quantity, entered_quantity)
    values (v_id, it.variant_id, it.quantity, coalesce(it.entered_quantity, it.quantity));
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'exchange.create', 'exchange', v_id, jsonb_build_object('status','pending'));
  return v_id;
end;
$$;

-- 3. send_to_repair
create or replace function public.send_to_repair(
  p_defect_item_ids uuid[], p_vendor text, p_sent_at date, p_expected_return_at date, p_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_repair_id uuid;
  v_hong uuid;
  v_sua uuid;
  it record;
  v_bad uuid;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu sửa'; end if;
  if p_vendor is null or length(trim(p_vendor)) = 0 then raise exception 'Đơn vị sửa chữa không được trống'; end if;
  if array_length(p_defect_item_ids, 1) is null then raise exception 'Chưa chọn vật tư hỏng nào'; end if;

  select dni.id into v_bad
  from public.defect_note_items dni
  join public.defect_notes d on d.id = dni.defect_note_id
  where dni.id = any(p_defect_item_ids)
    and (
      d.status <> 'staging'
      or exists (select 1 from public.repair_order_items roi where roi.defect_item_id = dni.id)
      or exists (select 1 from public.exchange_notes en
                 where en.linked_defect_id = d.id
                   and en.status in ('pending','approved','issued','received'))
    )
  limit 1;
  if v_bad is not null then
    raise exception 'Có dòng vật tư không hợp lệ (phiếu không còn tập kết, đã đi sửa, hoặc đang có phiếu Đổi Mới)';
  end if;

  select id into v_hong from public.stock_locations where code = 'KHO_HONG';
  select id into v_sua from public.stock_locations where code = 'KHO_DANG_SUA';

  insert into public.repair_orders (code, vendor, sent_at, expected_return_at, created_by)
  values (public.next_code('SC', 'public.repair_orders_seq'::regclass), p_vendor, p_sent_at, p_expected_return_at, p_by)
  returning id into v_repair_id;

  for it in select dni.* from public.defect_note_items dni
            where dni.id = any(p_defect_item_ids)
            order by dni.id loop
    insert into public.repair_order_items (repair_order_id, defect_item_id, variant_id, quantity, entered_quantity)
    values (v_repair_id, it.id, it.variant_id, it.quantity, coalesce(it.entered_quantity, it.quantity));

    -- Thu đồ hỏng về Kho hỏng (ref_type = 'defect')
    perform public._post_inventory_movement(jsonb_build_object(
      'document_type', 'defect_collect_in',
      'ref_type', 'defect',
      'document_id', it.defect_note_id,
      'idempotency_key', 'defect-collect-' || it.id || '-' || v_repair_id,
      'actor_id', p_by,
      'lines', jsonb_build_array(jsonb_build_object(
        'sku_id', it.variant_id,
        'to_location_id', v_hong,
        'entered_quantity', it.quantity
      ))
    ));

    -- Chuyển từ Kho hỏng sang Kho đang sửa (ref_type = 'repair')
    perform public._post_inventory_movement(jsonb_build_object(
      'document_type', 'repair_out',
      'ref_type', 'repair',
      'document_id', v_repair_id,
      'idempotency_key', 'repair-out-' || it.id || '-' || v_repair_id,
      'actor_id', p_by,
      'lines', jsonb_build_array(jsonb_build_object(
        'sku_id', it.variant_id,
        'from_location_id', v_hong,
        'to_location_id', v_sua,
        'entered_quantity', it.quantity
      ))
    ));
  end loop;

  update public.defect_notes d set status = 'in_repair'
  where d.status = 'staging'
    and d.id in (
      select distinct dni.defect_note_id
      from public.defect_note_items dni
      where dni.id = any(p_defect_item_ids)
    )
    and not exists (
      select 1 from public.defect_note_items dni
      where dni.defect_note_id = d.id
        and not exists (
          select 1 from public.repair_order_items roi
          where roi.defect_item_id = dni.id
        )
    );

  update public.defect_notes set repair_requested_by = null, repair_requested_at = null
  where id in (
    select distinct dni.defect_note_id
    from public.defect_note_items dni
    where dni.id = any(p_defect_item_ids)
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'repair.create', 'repair', v_repair_id, jsonb_build_object('status','in_repair'));
  return v_repair_id;
end;
$$;

-- 4. complete_repair
create or replace function public.complete_repair(p_repair_id uuid, p_outcomes jsonb, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.repair_status;
  v_main uuid;
  v_hong uuid;
  v_sua uuid;
  o record;
  r record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hoàn tất sửa chữa'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';
  select id into v_hong from public.stock_locations where code = 'KHO_HONG';
  select id into v_sua from public.stock_locations where code = 'KHO_DANG_SUA';

  select status into v_status from public.repair_orders where id = p_repair_id for update;
  if v_status <> 'in_repair' then raise exception 'Phiếu sửa không ở trạng thái đang sửa (hiện tại: %)', v_status; end if;

  for o in select value from jsonb_array_elements(p_outcomes) loop
    update public.repair_order_items
    set outcome = (o.value->>'outcome')::public.repair_outcome,
        cost = nullif(o.value->>'cost','')::numeric
    where id = (o.value->>'repair_item_id')::uuid
      and repair_order_id = p_repair_id;
  end loop;

  for r in select roi.* from public.repair_order_items roi where roi.repair_order_id = p_repair_id order by roi.variant_id loop
    if r.outcome = 'returned_to_stock' then
      perform public._post_inventory_movement(jsonb_build_object(
        'document_type', 'repair_return_in',
        'ref_type', 'repair',
        'document_id', p_repair_id,
        'idempotency_key', 'repair-return-' || r.id || '-' || p_repair_id,
        'actor_id', p_by,
        'lines', jsonb_build_array(jsonb_build_object(
          'sku_id', r.variant_id,
          'from_location_id', v_sua,
          'to_location_id', v_main,
          'entered_quantity', r.quantity
        ))
      ));
      update public.defect_note_items set resolution = 'repaired' where id = r.defect_item_id;
    elsif r.outcome = 'liquidation' then
      perform public._post_inventory_movement(jsonb_build_object(
        'document_type', 'transfer',
        'ref_type', 'repair',
        'document_id', p_repair_id,
        'idempotency_key', 'repair-liq-transfer-' || r.id || '-' || p_repair_id,
        'actor_id', p_by,
        'notes', 'Sửa không được → chờ thanh lý',
        'lines', jsonb_build_array(jsonb_build_object(
          'sku_id', r.variant_id,
          'from_location_id', v_sua,
          'to_location_id', v_hong,
          'entered_quantity', r.quantity
        ))
      ));
      update public.defect_note_items set resolution = 'liquidated' where id = r.defect_item_id;
    else
      raise exception 'Thiếu kết quả xử lý cho item %', r.id;
    end if;
  end loop;

  update public.repair_orders set status = 'returned', returned_at = now(), total_cost = (
    select coalesce(sum(cost),0) from public.repair_order_items where repair_order_id = p_repair_id
  ) where id = p_repair_id;

  update public.defect_notes d set status = (
    case
      when exists (
        select 1 from public.defect_note_items dni
        where dni.defect_note_id = d.id and (dni.resolution is null or dni.resolution = 'liquidated')
      ) then 'liquidated'::public.defect_status
      else 'returned'::public.defect_status
    end
  )
  where d.id in (
    select distinct dni.defect_note_id from public.defect_note_items dni
    join public.repair_order_items roi on roi.defect_item_id = dni.id
    where roi.repair_order_id = p_repair_id
  )
  and not exists (
    select 1 from public.defect_note_items dni where dni.defect_note_id = d.id and dni.resolution is null
  );
end;
$$;

-- 5. issue_exchange
create or replace function public.issue_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.exchange_status;
  v_main uuid;
  v_hong uuid;
  v_note uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được cấp phát'; end if;
  select id into v_main from public.stock_locations where code='KHO_CHINH';
  select id into v_hong from public.stock_locations where code='KHO_HONG';
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'approved' then raise exception 'Phiếu chưa được duyệt (hiện tại: %)', v_status; end if;

  for it in select i.variant_id, i.quantity from public.exchange_note_items i where i.exchange_note_id = p_id order by i.variant_id loop
    perform public._post_inventory_movement(jsonb_build_object(
      'document_type', 'exchange_out',
      'ref_type', 'exchange',
      'document_id', p_id,
      'idempotency_key', 'exchange-out-' || it.variant_id || '-' || p_id,
      'actor_id', p_by,
      'lines', jsonb_build_array(jsonb_build_object(
        'sku_id', it.variant_id,
        'from_location_id', v_main,
        'entered_quantity', it.quantity
      ))
    ));
  end loop;

  select linked_defect_id into v_note from public.exchange_notes where id = p_id;
  if v_note is not null then
    for it in select dni.variant_id, dni.quantity from public.defect_note_items dni where dni.defect_note_id = v_note order by dni.variant_id loop
      perform public._post_inventory_movement(jsonb_build_object(
        'document_type', 'defect_collect_in',
        'ref_type', 'defect',
        'document_id', v_note,
        'idempotency_key', 'exchange-collect-' || it.variant_id || '-' || v_note || '-' || p_id,
        'actor_id', p_by,
        'lines', jsonb_build_array(jsonb_build_object(
          'sku_id', it.variant_id,
          'to_location_id', v_hong,
          'entered_quantity', it.quantity
        ))
      ));
    end loop;
  end if;

  update public.exchange_notes set status='issued', issued_by=p_by, issued_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.issue', 'exchange', p_id,
          jsonb_build_object('status','approved'), jsonb_build_object('status','issued'));
end;
$$;

-- 6. liquidate_defects
create or replace function public.liquidate_defects(p_id uuid, p_items_outcome jsonb, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.liquidation_status;
  v_hong uuid;
  o record;
  r record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hoàn tất thanh lý'; end if;
  select id into v_hong from public.stock_locations where code = 'KHO_HONG';

  select status into v_status from public.liquidation_notes where id = p_id for update;
  if v_status <> 'approved' then raise exception 'Phiếu thanh lý chưa được duyệt (hiện tại: %)', v_status; end if;

  for o in select value from jsonb_array_elements(p_items_outcome) loop
    update public.liquidation_items set proceeds = (o.value->>'proceeds')::numeric
    where id = (o.value->>'item_id')::uuid and liquidation_note_id = p_id;
  end loop;

  for r in select * from public.liquidation_items where liquidation_note_id = p_id order by variant_id loop
    perform public._post_inventory_movement(jsonb_build_object(
      'document_type', 'liquidation_out',
      'ref_type', 'liquidation',
      'document_id', p_id,
      'idempotency_key', 'liquidation-out-' || r.id || '-' || p_id,
      'actor_id', p_by,
      'lines', jsonb_build_array(jsonb_build_object(
        'sku_id', r.variant_id,
        'from_location_id', v_hong,
        'entered_quantity', r.quantity
      ))
    ));
  end loop;

  update public.liquidation_notes set status = 'completed', completed_at = now() where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.complete', 'liquidation', p_id,
          jsonb_build_object('status','approved'), jsonb_build_object('status','completed'));
end;
$$;

-- Backfill entered_quantity for any remaining null rows
update public.receipt_items set entered_quantity = quantity where entered_quantity is null;
update public.issue_items set entered_quantity = quantity where entered_quantity is null;
update public.requisition_items set entered_quantity = quantity where entered_quantity is null;
update public.requisition_return_items set entered_quantity = quantity where entered_quantity is null;
update public.defect_note_items set entered_quantity = quantity where entered_quantity is null;
update public.exchange_note_items set entered_quantity = quantity where entered_quantity is null;
update public.repair_order_items set entered_quantity = quantity where entered_quantity is null;
update public.liquidation_items set entered_quantity = quantity where entered_quantity is null;
update public.tool_borrowing_items set entered_quantity = quantity where entered_quantity is null;
