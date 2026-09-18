-- 0082_task9_issue_transfer_stocktake_rpcs.sql
-- Direct Issues, Transfers, and Stocktake migrated to canonical posting kernel

-- 1. Ensure snapshot and transaction columns exist on stocktake_items
alter table public.stocktake_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists entered_quantity numeric(20,6),
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

-- 2. Update post_stocktake_adjustment_command role permissions
create or replace function public.post_stocktake_adjustment_command(p_command jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_actor uuid := coalesce(auth.uid(), nullif(p_command->>'actor_id','')::uuid);
begin
  if not public._posting_actor_has_role(v_actor, array['superuser','owner','accountant','warehouse']) then
    raise exception 'Actor không có quyền duyệt điều chỉnh kiểm kê';
  end if;
  return public._post_inventory_movement(
    p_command || jsonb_build_object(
      'document_type', 'stocktake_adjustment',
      'actor_id', v_actor,
      'required_roles', jsonb_build_array('superuser','owner','accountant','warehouse')
    )
  );
end $$;

-- 3. Direct Issues RPCs
drop function if exists public.create_issue(jsonb, text, uuid, uuid, text, text, text, uuid);
drop function if exists public.create_issue(jsonb, text, uuid, uuid, text, text, text, uuid, uuid);

create or replace function public.create_issue(
  p_items jsonb, p_destination_type text,
  p_zone_id uuid, p_customer_id uuid,
  p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid,
  p_sub_zone_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it record;
  v_sku_id uuid;
  v_tu_id uuid;
  v_entered numeric;
  v_factor numeric;
  v_base_qty numeric;
  v_scale smallint;
  v_price numeric;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được lập phiếu xuất'; end if;
  if p_destination_type not in ('zone','customer') then raise exception 'Kiểu đích không hợp lệ'; end if;
  if p_destination_type = 'zone' and p_zone_id is null then raise exception 'Phải chọn khu nhận'; end if;
  if p_destination_type = 'customer' and p_customer_id is null then raise exception 'Phải chọn khách hàng'; end if;

  insert into public.issues
    (code, destination_type, zone_id, sub_zone_id, customer_id, vehicle_plate, driver_name, creator_id, notes)
  values (
    public.next_code('PXK', 'public.issues_seq'::regclass),
    p_destination_type, p_zone_id, p_sub_zone_id, p_customer_id,
    nullif(p_vehicle_plate,''), nullif(p_driver_name,''), p_by, nullif(p_notes,'')
  )
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    v_sku_id := coalesce(nullif(it.value->>'sku_id',''), nullif(it.value->>'variant_id',''))::uuid;
    if v_sku_id is null then raise exception 'Dòng thiếu SKU ID'; end if;
    v_tu_id := nullif(it.value->>'transaction_unit_id','')::uuid;
    v_entered := coalesce((it.value->>'entered_quantity')::numeric, (it.value->>'quantity')::numeric);
    if v_entered is null or v_entered <= 0 then raise exception 'Số lượng xuất phải lớn hơn 0'; end if;

    v_price := nullif(it.value->>'unit_price','')::numeric;
    if p_destination_type = 'customer' and (v_price is null or v_price <= 0) then
      raise exception 'Xuất bán cho khách phải có đơn giá lớn hơn 0';
    end if;

    select decimal_scale into v_scale from public.units u join public.variants v on v.base_unit_id = u.id where v.id = v_sku_id;
    if v_tu_id is not null then
      select factor_to_base into v_factor from public.sku_transaction_units where id = v_tu_id and sku_id = v_sku_id;
    else
      v_factor := 1;
    end if;
    v_factor := coalesce(v_factor, 1);
    v_base_qty := round(v_entered * v_factor, coalesce(v_scale, 2));

    insert into public.issue_items (
      issue_id, variant_id, quantity, unit_price,
      transaction_unit_id, entered_quantity, conversion_factor_snapshot, snapshot_quality
    )
    values (
      v_id, v_sku_id, v_base_qty, v_price,
      v_tu_id, v_entered, v_factor, 'complete'
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'issue.create', 'issue', v_id, jsonb_build_object('status','draft'));
  return v_id;
end;
$$;

create or replace function public.post_issue(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_main uuid;
  v_notes text;
  it record;
  v_policy text;
  v_tracking text;
  v_lines jsonb := '[]'::jsonb;
  v_allocs jsonb;
  v_comp record;
  v_comp_qty numeric;
  v_comp_allocs jsonb;
  v_bom_version uuid;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được xác nhận xuất'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';
  select status, notes into v_status, v_notes from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;
  if v_status <> 'draft' then raise exception 'Phiếu xuất không ở trạng thái nháp (hiện tại: %)', v_status; end if;
  if not exists (select 1 from public.issue_items where issue_id = p_id) then
    raise exception 'Phiếu xuất không có vật tư';
  end if;

  for it in
    select ii.*, v.inventory_policy, v.tracking_policy
    from public.issue_items ii
    join public.variants v on v.id = ii.variant_id
    where ii.issue_id = p_id
    order by ii.variant_id
  loop
    if it.inventory_policy = 'virtual_kit' then
      select active_version_id into v_bom_version from public.bom_headers where sku_id = it.variant_id;
      if v_bom_version is null then raise exception 'Bộ ảo % chưa có BOM đang hoạt động', it.variant_id; end if;

      for v_comp in
        select bi.component_sku_id, bi.base_quantity, bi.wastage_percent, cv.tracking_policy as comp_tracking
        from public.bom_items bi
        join public.variants cv on cv.id = bi.component_sku_id
        where bi.bom_version_id = v_bom_version
        order by bi.component_sku_id
      loop
        v_comp_qty := public._posting_round_base(
          v_comp.base_quantity * (1 + v_comp.wastage_percent / 100) * coalesce(it.quantity, it.entered_quantity),
          6::smallint
        );
        v_comp_allocs := '[]'::jsonb;
        if v_comp.comp_tracking in ('lot','lot_expiry') then
          select coalesce(jsonb_agg(jsonb_build_object('lot_id', lot_id, 'quantity', take)), '[]'::jsonb)
          into v_comp_allocs
          from public._posting_pick_lots(v_comp.component_sku_id, v_main, v_comp_qty);
        elsif v_comp.comp_tracking = 'serial' then
          select coalesce(jsonb_agg(jsonb_build_object('serial_id', id, 'quantity', 1)), '[]'::jsonb)
          into v_comp_allocs
          from (
            select id from public.serial_items
            where sku_id = v_comp.component_sku_id and location_id = v_main and status = 'available'
            order by created_at asc limit v_comp_qty::int
          ) s;
          if jsonb_array_length(v_comp_allocs) < v_comp_qty then
            raise exception 'Không đủ serial linh kiện % tại kho chính', v_comp.component_sku_id;
          end if;
        end if;

        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'sku_id', v_comp.component_sku_id,
          'from_location_id', v_main,
          'entered_quantity', v_comp_qty,
          'transaction_unit_id', null,
          'allocations', v_comp_allocs
        ));
      end loop;
    else
      v_allocs := '[]'::jsonb;
      if it.tracking_policy in ('lot','lot_expiry') then
        select coalesce(jsonb_agg(jsonb_build_object('lot_id', lot_id, 'quantity', take)), '[]'::jsonb)
        into v_allocs
        from public._posting_pick_lots(it.variant_id, v_main, coalesce(it.quantity, it.entered_quantity));
      elsif it.tracking_policy = 'serial' then
        select coalesce(jsonb_agg(jsonb_build_object('serial_id', id, 'quantity', 1)), '[]'::jsonb)
        into v_allocs
        from (
          select id from public.serial_items
          where sku_id = it.variant_id and location_id = v_main and status = 'available'
          order by created_at asc limit coalesce(it.quantity, it.entered_quantity)::int
        ) s;
        if jsonb_array_length(v_allocs) < coalesce(it.quantity, it.entered_quantity) then
          raise exception 'Không đủ serial cho SKU % tại kho chính', it.variant_id;
        end if;
      end if;

      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'sku_id', it.variant_id,
        'from_location_id', v_main,
        'entered_quantity', coalesce(it.entered_quantity, it.quantity),
        'transaction_unit_id', it.transaction_unit_id,
        'unit_cost', it.unit_price,
        'allocations', v_allocs
      ));
    end if;

    update public.issue_items
    set snapshot_quality = 'complete',
        conversion_factor_snapshot = coalesce(conversion_factor_snapshot, 1),
        sku_name_snapshot = (select p.name from public.products p join public.variants vv on vv.product_id = p.id where vv.id = it.variant_id),
        uom_name_snapshot = coalesce(
          (select display_name from public.sku_transaction_units where id = it.transaction_unit_id),
          (select u.name from public.units u join public.variants vv on vv.base_unit_id = u.id where vv.id = it.variant_id)
        )
    where id = it.id;
  end loop;

  if jsonb_array_length(v_lines) > 0 then
    perform public.post_direct_issue_command(jsonb_build_object(
      'document_id', p_id,
      'actor_id', coalesce(auth.uid(), p_by),
      'idempotency_key', 'issue-direct-' || p_id::text,
      'notes', v_notes,
      'lines', v_lines
    ));
  end if;

  update public.issues set status = 'posted', updated_at = now() where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.post', 'issue', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','posted'));
end;
$$;

create or replace function public.cancel_issue(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được hủy phiếu xuất'; end if;
  select status into v_status from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;
  if v_status <> 'draft' then raise exception 'Chỉ phiếu nháp mới được hủy (hiện tại: %)', v_status; end if;
  update public.issues set status = 'cancelled', updated_at = now() where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.cancel', 'issue', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','cancelled'));
end;
$$;

-- 4. Transfers and Adjustments RPCs
create or replace function public.transfer_stock(p_items jsonb, p_from_loc uuid, p_to_loc uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  it record;
  v_lines jsonb := '[]'::jsonb;
  v_sku_id uuid;
  v_tu_id uuid;
  v_entered numeric;
  v_qty numeric;
  v_factor numeric;
  v_policy text;
  v_tracking text;
  v_allocs jsonb;
  v_doc_id uuid := gen_random_uuid();
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được chuyển kho'; end if;
  if p_from_loc = p_to_loc then raise exception 'Kho nguồn và đích phải khác nhau'; end if;
  if p_from_loc is null or p_to_loc is null then raise exception 'Phải chọn đủ kho nguồn và kho đích'; end if;

  for it in select value from jsonb_array_elements(p_items) loop
    v_sku_id := coalesce(nullif(it.value->>'sku_id',''), nullif(it.value->>'variant_id',''))::uuid;
    if v_sku_id is null then raise exception 'Dòng thiếu SKU'; end if;
    v_tu_id := nullif(it.value->>'transaction_unit_id','')::uuid;
    v_entered := coalesce((it.value->>'entered_quantity')::numeric, (it.value->>'quantity')::numeric);
    if v_entered is null or v_entered <= 0 then raise exception 'Số lượng chuyển phải lớn hơn 0'; end if;

    select inventory_policy, tracking_policy into v_policy, v_tracking from public.variants where id = v_sku_id;
    if not found then raise exception 'Không tìm thấy SKU %', v_sku_id; end if;

    if v_policy = 'virtual_kit' then
      raise exception 'Không thể chuyển kho bộ ảo (không có tồn vật lý)';
    end if;

    if v_tu_id is not null then
      select factor_to_base into v_factor from public.sku_transaction_units where id = v_tu_id and sku_id = v_sku_id;
    else
      v_factor := 1;
    end if;
    v_factor := coalesce(v_factor, 1);
    v_qty := v_entered * v_factor;

    v_allocs := '[]'::jsonb;
    if it.value ? 'allocations' and jsonb_array_length(coalesce(it.value->'allocations','[]'::jsonb)) > 0 then
      v_allocs := it.value->'allocations';
    else
      if v_tracking in ('lot','lot_expiry') then
        select coalesce(jsonb_agg(jsonb_build_object('lot_id', lot_id, 'quantity', take)), '[]'::jsonb)
        into v_allocs
        from public._posting_pick_lots(v_sku_id, p_from_loc, v_qty);
      elsif v_tracking = 'serial' then
        select coalesce(jsonb_agg(jsonb_build_object('serial_id', id, 'quantity', 1)), '[]'::jsonb)
        into v_allocs
        from (
          select id from public.serial_items
          where sku_id = v_sku_id and location_id = p_from_loc and status = 'available'
          order by created_at asc
          limit v_qty::int
        ) s;
        if jsonb_array_length(v_allocs) < v_qty then
          raise exception 'Không đủ serial tại kho nguồn';
        end if;
      end if;
    end if;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'sku_id', v_sku_id,
      'from_location_id', p_from_loc,
      'to_location_id', p_to_loc,
      'entered_quantity', v_entered,
      'transaction_unit_id', v_tu_id,
      'allocations', v_allocs
    ));
  end loop;

  if jsonb_array_length(v_lines) = 0 then
    raise exception 'Không có vật tư nào để chuyển';
  end if;

  perform public.post_transfer_command(jsonb_build_object(
    'document_id', v_doc_id,
    'actor_id', coalesce(auth.uid(), p_by),
    'idempotency_key', 'transfer-' || v_doc_id::text,
    'notes', 'Điều chuyển kho nội bộ',
    'lines', v_lines
  ));

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'stock.transfer', 'transfer', v_doc_id,
          jsonb_build_object('from', p_from_loc, 'to', p_to_loc, 'lines_count', jsonb_array_length(v_lines)));
end;
$$;

drop function if exists public.adjust_stock(uuid, uuid, integer, text, uuid);
drop function if exists public.adjust_stock(uuid, uuid, numeric, text, uuid);

create or replace function public.adjust_stock(
  p_variant_id uuid, p_location_id uuid, p_delta numeric, p_reason text, p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_sku public.variants%rowtype;
  v_lines jsonb;
  v_doc_id uuid := gen_random_uuid();
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được điều chỉnh tồn'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'Bắt buộc nhập lý do điều chỉnh'; end if;
  if p_delta = 0 or p_delta is null then raise exception 'Delta phải khác 0'; end if;

  select * into v_sku from public.variants where id = p_variant_id;
  if not found then raise exception 'Không tìm thấy SKU %', p_variant_id; end if;
  if v_sku.inventory_policy = 'virtual_kit' then
    raise exception 'Không thể điều chỉnh tồn bộ ảo (không có tồn vật lý)';
  end if;

  if p_delta > 0 then
    v_lines := jsonb_build_array(jsonb_build_object(
      'sku_id', p_variant_id,
      'to_location_id', p_location_id,
      'entered_quantity', p_delta,
      'transaction_unit_id', null
    ));
  else
    v_lines := jsonb_build_array(jsonb_build_object(
      'sku_id', p_variant_id,
      'from_location_id', p_location_id,
      'entered_quantity', -p_delta,
      'transaction_unit_id', null
    ));
  end if;

  perform public.post_stocktake_adjustment_command(jsonb_build_object(
    'document_id', v_doc_id,
    'actor_id', coalesce(auth.uid(), p_by),
    'idempotency_key', 'adjust-' || v_doc_id::text,
    'notes', p_reason,
    'lines', v_lines
  ));

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'stock.adjust', 'variant', p_variant_id,
          jsonb_build_object('delta', p_delta, 'reason', p_reason, 'location_id', p_location_id));
end;
$$;

-- 5. Stocktake RPCs
drop function if exists public.create_stocktake(uuid, uuid);
drop function if exists public.create_stocktake(uuid, text, uuid);

create or replace function public.create_stocktake(
  p_location_id uuid, p_name text, p_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  r record;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được tạo kiểm kê'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Phải nhập tên phiếu kiểm kê'; end if;

  insert into public.stocktake_sessions (code, name, location_id, created_by)
  values (public.next_code('PKK', 'public.stocktake_seq'::regclass), trim(p_name), p_location_id, p_by)
  returning id into v_id;

  -- Exclude virtual kits from physical stocktake; count stocked assemblies and standard SKUs normally.
  for r in
    select sb.variant_id, sb.quantity
    from public.stock_balances sb
    join public.variants v on v.id = sb.variant_id
    where sb.location_id = p_location_id
      and sb.quantity > 0
      and v.inventory_policy <> 'virtual_kit'
    order by sb.variant_id
  loop
    insert into public.stocktake_items (
      session_id, variant_id, system_qty, actual_qty,
      snapshot_quality, conversion_factor_snapshot
    )
    values (v_id, r.variant_id, r.quantity, r.quantity, 'complete', 1);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'stocktake.create', 'stocktake', v_id, jsonb_build_object('status','draft','name',p_name));

  return v_id;
end;
$$;

create or replace function public.create_stocktake(p_location_id uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public.create_stocktake(p_location_id, 'Kỳ kiểm kê ' || to_char(now(), 'DD/MM/YYYY HH24:MI'), p_by);
end;
$$;

create or replace function public.post_stocktake(p_session_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.stocktake_status;
  v_loc uuid;
  v_code text;
  r record;
  v_delta numeric;
  v_lines jsonb := '[]'::jsonb;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được chốt kiểm kê'; end if;
  select status, location_id, code into v_status, v_loc, v_code
  from public.stocktake_sessions where id = p_session_id for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê'; end if;
  if v_status <> 'draft' then raise exception 'Phiếu kiểm kê không ở trạng thái nháp (hiện tại: %)', v_status; end if;

  -- Process only CHECKED items (items actually counted)
  for r in
    select si.*, v.inventory_policy
    from public.stocktake_items si
    join public.variants v on v.id = si.variant_id
    where si.session_id = p_session_id and si.checked = true
    order by si.variant_id
  loop
    if r.inventory_policy = 'virtual_kit' then
      raise exception 'Không thể kiểm kê bộ ảo (không có tồn vật lý)';
    end if;

    v_delta := r.actual_qty - r.system_qty;
    if v_delta > 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'sku_id', r.variant_id,
        'to_location_id', v_loc,
        'entered_quantity', v_delta,
        'transaction_unit_id', r.transaction_unit_id
      ));
    elsif v_delta < 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'sku_id', r.variant_id,
        'from_location_id', v_loc,
        'entered_quantity', -v_delta,
        'transaction_unit_id', r.transaction_unit_id
      ));
    end if;

    update public.stocktake_items
    set snapshot_quality = 'complete',
        conversion_factor_snapshot = coalesce(conversion_factor_snapshot, 1)
    where id = r.id;
  end loop;

  if jsonb_array_length(v_lines) > 0 then
    perform public.post_stocktake_adjustment_command(jsonb_build_object(
      'document_id', p_session_id,
      'actor_id', coalesce(auth.uid(), p_by),
      'idempotency_key', 'stocktake-' || p_session_id::text,
      'notes', 'Điều chỉnh chênh lệch kỳ kiểm kê ' || v_code,
      'lines', v_lines
    ));
  end if;

  update public.stocktake_sessions set status = 'posted', posted_at = now() where id = p_session_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'stocktake.post', 'stocktake', p_session_id, jsonb_build_object('status','posted'));
end;
$$;
