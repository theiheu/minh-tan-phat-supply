-- 0036_issues_rpc.sql — nghiệp vụ phiếu xuất kho (mirror receipts).
-- Bám sát style 0017_rpc.sql: security definer, is_manager() guard,
-- SELECT ... FOR UPDATE trên issues.status, order-by-variant_id chống
-- deadlock, next_code('PXK', 'public.issues_seq'), audit_logs đầy đủ.

-- Bung composite thành linh kiện cho danh sách (variant_id, quantity) bất kỳ.
create or replace function public._expand_variant_demand(p_items jsonb)
returns table (variant_id uuid, quantity int)
language sql stable security definer set search_path = public as $$
  select t.variant_id, sum(t.qty)::int as quantity
  from (
    select (it.value->>'variant_id')::uuid as variant_id, (it.value->>'quantity')::int as qty
    from jsonb_array_elements(p_items) it
    where not exists (
      select 1 from public.variant_components vc
      where vc.parent_variant_id = (it.value->>'variant_id')::uuid
    )
    union all
    select vc.child_variant_id, ((it.value->>'quantity')::int) * vc.quantity as qty
    from jsonb_array_elements(p_items) it
    join public.variant_components vc
      on vc.parent_variant_id = (it.value->>'variant_id')::uuid
  ) t group by t.variant_id
$$;

create or replace function public.create_issue(
  p_items jsonb, p_destination_type text,
  p_zone_id uuid, p_customer_id uuid,
  p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được lập phiếu xuất'; end if;
  if p_destination_type not in ('zone','customer') then raise exception 'Kiểu đích không hợp lệ'; end if;
  if p_destination_type = 'zone' and p_zone_id is null then raise exception 'Phải chọn khu nhận'; end if;
  if p_destination_type = 'customer' and p_customer_id is null then raise exception 'Phải chọn khách hàng'; end if;

  insert into public.issues
    (code, destination_type, zone_id, customer_id, vehicle_plate, driver_name, creator_id, notes)
  values (
    public.next_code('PXK', 'public.issues_seq'::regclass),
    p_destination_type, p_zone_id, p_customer_id,
    nullif(p_vehicle_plate,''), nullif(p_driver_name,''), p_by, nullif(p_notes,'')
  )
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.issue_items (issue_id, variant_id, quantity, unit_price)
    values (
      v_id, (it.value->>'variant_id')::uuid, (it.value->>'quantity')::int,
      nullif(it.value->>'unit_price','')::numeric
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
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được xác nhận xuất'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';
  select status into v_status from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;
  if v_status <> 'draft' then raise exception 'Phiếu xuất không ở trạng thái nháp (hiện tại: %)', v_status; end if;
  if not exists (select 1 from public.issue_items where issue_id = p_id) then
    raise exception 'Phiếu xuất không có vật tư';
  end if;

  -- trừ stock từng dòng (đã bung composite), order by variant_id chống deadlock
  for it in
    select d.variant_id, d.quantity
    from public._expand_variant_demand(
      (select jsonb_agg(jsonb_build_object('variant_id', i.variant_id, 'quantity', i.quantity))
       from public.issue_items i where i.issue_id = p_id)
    ) d order by d.variant_id
  loop
    perform public._move_stock(it.variant_id, v_main, null, it.quantity, 'issue_out', 'issue', p_id, p_by);
  end loop;

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
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hủy phiếu xuất'; end if;
  select status into v_status from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;
  if v_status <> 'draft' then raise exception 'Chỉ phiếu nháp mới được hủy (hiện tại: %)', v_status; end if;
  update public.issues set status = 'cancelled', updated_at = now() where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.cancel', 'issue', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','cancelled'));
end;
$$;
