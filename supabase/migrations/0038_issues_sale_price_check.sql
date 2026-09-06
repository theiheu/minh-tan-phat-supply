-- 0038_issues_sale_price_check.sql — ràng buộc đơn giá > 0 khi xuất bán cho khách.
-- create_issue/post_issue (0036) được create or replace lại, GIỮ NGUYÊN mọi guard,
-- audit + SELECT ... FOR UPDATE; chỉ THÊM: khi destination = customer, mọi dòng
-- issue_items phải có unit_price > 0 (null hoặc <= 0 → raise cùng thông báo).
-- Không thêm guard rỗng p_items cho create_issue (mirror receipts — UI bắt buộc có
-- dòng; post_issue đã sẵn guard 'Phiếu xuất không có vật tư').

create or replace function public.create_issue(
  p_items jsonb, p_destination_type text,
  p_zone_id uuid, p_customer_id uuid,
  p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; it record; v_price numeric;
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
    v_price := nullif(it.value->>'unit_price','')::numeric;
    if p_destination_type = 'customer' and (v_price is null or v_price <= 0) then
      raise exception 'Xuất bán cho khách phải có đơn giá lớn hơn 0';
    end if;
    insert into public.issue_items (issue_id, variant_id, quantity, unit_price)
    values (
      v_id, (it.value->>'variant_id')::uuid, (it.value->>'quantity')::int,
      v_price
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
  -- lưới an toàn lúc post: xuất bán cho khách, mọi dòng phải có đơn giá > 0
  if exists (
    select 1
    from public.issues iss
    join public.issue_items ii on ii.issue_id = iss.id
    where iss.id = p_id
      and iss.destination_type = 'customer'
      and (ii.unit_price is null or ii.unit_price <= 0)
  ) then
    raise exception 'Xuất bán cho khách phải có đơn giá lớn hơn 0';
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
