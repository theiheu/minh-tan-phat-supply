-- 0081_task8_requisition_rpcs.sql
-- Replace create, approve and fulfill requisition RPCs to use the canonical posting kernel

drop function if exists public.create_requisition(jsonb, uuid, text, public.requisition_type, uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.create_requisition(
  p_items jsonb, p_zone_id uuid, p_purpose text, p_type public.requisition_type,
  p_linked_defect_id uuid, p_requester_id uuid, p_sub_zone_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_requester_id is distinct from auth.uid() and not public.can_post_inventory() then
    raise exception 'Chỉ được tạo phiếu cho chính mình';
  end if;
  if p_purpose is null or length(trim(p_purpose)) = 0 then
    raise exception 'Mục đích không được trống';
  end if;
  if p_type = 'replacement' and p_linked_defect_id is null then
    raise exception 'Đổi mới phải chọn phiếu hỏng liên quan';
  end if;

  insert into public.requisitions
    (code, requester_id, zone_id, sub_zone_id, purpose, requisition_type, linked_defect_id)
  values
    (public.next_code('REQ', 'public.requisitions_seq'::regclass), p_requester_id, p_zone_id, p_sub_zone_id, p_purpose, p_type, p_linked_defect_id)
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.requisition_items (requisition_id, variant_id, quantity, transaction_unit_id, entered_quantity)
    values (
      v_id, 
      (it.value->>'sku_id')::uuid, 
      1,
      nullif(it.value->>'transaction_unit_id','')::uuid,
      (it.value->>'entered_quantity')::numeric
    );
     -- Fix quantity for legacy compatibility until Task 13
    update public.requisition_items ri 
    set quantity = round((it.value->>'entered_quantity')::numeric * coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = nullif(it.value->>'transaction_unit_id','')::uuid limit 1), 1))
    where ri.requisition_id = v_id and ri.variant_id = (it.value->>'sku_id')::uuid;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'requisition.create', 'requisition', v_id, jsonb_build_object('status','draft'));

  return v_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.approve_requisition(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare 
  v_status public.requisition_status;
  it record;
  component record;
  v_main uuid;
  v_res_id uuid;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được duyệt'; end if;
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status <> 'pending' then raise exception 'Phiếu không ở trạng thái đang chờ (hiện tại: %)', v_status; end if;

  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  update public.requisitions
  set status = 'approved', approved_by = p_by, approved_at = now()
  where id = p_id;

  -- Reserve the SKU itself, or reserve each component for a virtual kit using
  -- the active BOM version as the immutable allocation snapshot.
  for it in
    select ri.*, v.inventory_policy
    from public.requisition_items ri
    join public.variants v on v.id = ri.variant_id
    where ri.requisition_id = p_id
    order by ri.variant_id
  loop
    if it.inventory_policy = 'virtual_kit' then
      for component in
        select bi.component_sku_id,
               bi.base_quantity * (1 + bi.wastage_percent / 100) * coalesce(it.quantity, it.entered_quantity) as required_quantity,
               bh.active_version_id as bom_version_id
        from public.bom_headers bh
        join public.bom_items bi on bi.bom_version_id = bh.active_version_id
        where bh.sku_id = it.variant_id and bh.active_version_id is not null
        order by bi.component_sku_id
      loop
        v_res_id := public.reserve_stock(jsonb_build_object(
          'sku_id', component.component_sku_id,
          'location_id', v_main,
          'source_document_type', 'requisition',
          'source_document_id', p_id,
          'source_document_line_id', it.id,
          'base_quantity', component.required_quantity,
          'idempotency_key', 'res-req-' || p_id::text || '-' || it.id::text || '-' || component.component_sku_id::text
        ));
        update public.stock_reservations
        set bom_version_id = component.bom_version_id
        where id = v_res_id;
      end loop;
      if not found then raise exception 'Bộ vật tư % chưa có BOM đang hoạt động', it.variant_id; end if;
    else
      perform public.reserve_stock(jsonb_build_object(
        'sku_id', it.variant_id,
        'location_id', v_main,
        'source_document_type', 'requisition',
        'source_document_id', p_id,
        'source_document_line_id', it.id,
        'base_quantity', it.quantity,
        'idempotency_key', 'res-req-' || p_id::text || '-' || it.id::text
      ));
    end if;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.approve', 'requisition', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','approved'));
end;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_requisition(p_id uuid, p_by uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare
  it record;
  v_main uuid;
  v_status public.requisition_status;
  v_command jsonb := '{}'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_res_id uuid;
  reservation record;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được cấp phát'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status into v_status from public.requisitions where id = p_id for update;
  if v_status <> 'approved' then raise exception 'Phiếu chưa được duyệt (trạng thái: %)', v_status; end if;

  for it in select * from public.requisition_items where requisition_id = p_id order by variant_id loop
    v_res_id := null;
    for reservation in
      select * from public.stock_reservations
      where source_document_type = 'requisition'
        and source_document_line_id = it.id
        and status in ('active','partially_consumed')
      order by sku_id
    loop
      v_res_id := reservation.id;
      perform public.post_reserved_issue(
        reservation.id,
        reservation.reserved_quantity - reservation.consumed_quantity,
        p_id,
        '[]'::jsonb,
        'issued-res-req-' || p_id::text || '-' || reservation.id::text,
        p_by
      );
    end loop;
    if v_res_id is null then
      -- No reservation (pre-migration phiếu không có reservation, hoặc reservation đã consumed hết).
      -- Fall back to direct issue so legacy approved requisitions can still be fulfilled.
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'sku_id', it.variant_id,
          'from_location_id', v_main,
          'entered_quantity', coalesce(it.entered_quantity, it.quantity),
          'transaction_unit_id', it.transaction_unit_id
        )
      );
    end if;

    update public.requisition_items 
    set snapshot_quality = 'complete',
        conversion_factor_snapshot = coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = it.transaction_unit_id limit 1), 1)
    where id = it.id;
  end loop;

  if jsonb_array_length(v_lines) > 0 then
    perform public.post_direct_issue_command(jsonb_build_object(
      'document_id', p_id,
      'idempotency_key', 'issue-direct-req-' || p_id::text,
      'notes', p_notes,
      'lines', v_lines
    ));
  end if;

  update public.requisitions set status = 'issued', fulfilled_by = p_by, fulfilled_at = now(), fulfillment_notes = p_notes where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.fulfill', 'requisition', p_id,
          jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'issued'));
end;
$$;

CREATE OR REPLACE FUNCTION public.return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.requisition_status;
  v_req_code text;
  it record;
  qty int;
  existing_rq int;
  v_main uuid;
  v_lines jsonb := '[]'::jsonb;
  v_return_id uuid;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được nhận trả vật tư'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status, code into v_status, v_req_code from public.requisitions where id = p_requisition_id for update;
  if v_status not in ('issued', 'received') then
    raise exception 'Chỉ có thể trả lại hàng từ phiếu đã cấp phát / đã nhận (hiện tại: %)', v_status;
  end if;

  insert into public.requisition_returns(requisition_id,returned_by)
  values(p_requisition_id,p_by) returning id into v_return_id;

  for it in select value from jsonb_array_elements(p_items) loop
    qty := (it.value->>'quantity')::int;
    select ri.quantity - coalesce((
      select sum(rri.quantity) from public.requisition_returns rr
      join public.requisition_return_items rri on rri.return_id=rr.id
      where rr.requisition_id=p_requisition_id and rri.variant_id=ri.variant_id
    ),0) into existing_rq
    from public.requisition_items ri
    where ri.requisition_id=p_requisition_id and ri.variant_id=(it.value->>'sku_id')::uuid;

    if existing_rq is null then raise exception 'Vật tư % không có trong phiếu yêu cầu', it.value->>'sku_id'; end if;
    if qty > existing_rq then raise exception 'Số lượng trả (%) vượt số lượng còn lại (%)', qty, existing_rq; end if;

    insert into public.requisition_return_items (return_id, variant_id, quantity, transaction_unit_id, entered_quantity)
    values (
      v_return_id, 
      (it.value->>'sku_id')::uuid, 
      qty, 
      nullif(it.value->>'transaction_unit_id','')::uuid,
      (it.value->>'entered_quantity')::numeric
    );

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'sku_id', (it.value->>'sku_id')::uuid,
        'to_location_id', v_main,
        'entered_quantity', (it.value->>'entered_quantity')::numeric,
        'transaction_unit_id', nullif(it.value->>'transaction_unit_id','')::uuid
      )
    );
  end loop;

  if jsonb_array_length(v_lines) > 0 then
    perform public.post_return_command(jsonb_build_object(
      'document_id', p_requisition_id,
      'idempotency_key', 'return-req-' || p_requisition_id::text || '-' || gen_random_uuid()::text,
      'notes', 'Trả lại theo phiếu ' || v_req_code,
      'lines', v_lines
    ));
  end if;

  -- A return event does not replace the requisition state. The item-level history
  -- records how much was returned while the document remains issued/received.
  update public.requisitions set updated_at = now() where id = p_requisition_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.return', 'requisition', p_requisition_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', v_status, 'return_id', v_return_id));
end;
$$;

CREATE OR REPLACE FUNCTION public.reject_requisition(p_id uuid, p_by uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.requisition_status; r record;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được từ chối'; end if;
  if p_reason is null or length(trim(p_reason))=0 then raise exception 'Phải nhập lý do từ chối'; end if;
  select status into v_status from public.requisitions where id=p_id for update;
  if v_status not in ('pending','approved') then raise exception 'Không thể từ chối phiếu ở trạng thái %',v_status; end if;
  if v_status='approved' then
    for r in select id from public.stock_reservations where source_document_type='requisition' and source_document_id=p_id and status in ('active','partially_consumed') loop
      perform public.release_reservation(r.id,p_by);
    end loop;
  end if;
  update public.requisitions set status='rejected',rejection_reason=p_reason where id=p_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before,after)
  values(p_by,'requisition.reject','requisition',p_id,jsonb_build_object('status',v_status),jsonb_build_object('status','rejected'));
end $$;

CREATE OR REPLACE FUNCTION public.cancel_requisition(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.requisition_status; v_requester uuid; r record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status,requester_id into v_status,v_requester from public.requisitions where id=p_id for update;
  if v_requester is distinct from auth.uid() and not public.can_post_inventory() then raise exception 'Chỉ người yêu cầu mới được hủy'; end if;
  if v_status not in ('draft','pending','approved') then raise exception 'Không thể hủy phiếu ở trạng thái %',v_status; end if;
  if v_status='approved' then
    for r in select id from public.stock_reservations where source_document_type='requisition' and source_document_id=p_id and status in ('active','partially_consumed') loop
      perform public.release_reservation(r.id,p_by);
    end loop;
  end if;
  update public.requisitions set status='cancelled' where id=p_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before,after)
  values(p_by,'requisition.cancel','requisition',p_id,jsonb_build_object('status',v_status),jsonb_build_object('status','cancelled'));
end $$;
