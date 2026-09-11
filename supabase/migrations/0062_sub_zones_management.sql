-- 0062_sub_zones_management.sql — Quản lý Trại/Phân xưởng trực thuộc Khu vực (Sub-zones)

-- 1. Tạo bảng public.sub_zones
create table if not exists public.sub_zones (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  name text not null,
  description text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_sub_zones_zone_id on public.sub_zones(zone_id);
create unique index if not exists idx_sub_zones_zone_name_unique on public.sub_zones(zone_id, lower(name)) where deleted_at is null;

-- RLS sub_zones
alter table public.sub_zones enable row level security;

drop policy if exists "sub_zones_read_all" on public.sub_zones;
create policy "sub_zones_read_all" on public.sub_zones for select to authenticated using (true);

drop policy if exists "sub_zones_manager_modify" on public.sub_zones;
create policy "sub_zones_manager_modify" on public.sub_zones for all to authenticated using (public.is_manager());

-- 2. Thêm cột sub_zone_id vào các bảng nghiệp vụ
alter table public.requisitions add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_requisitions_sub_zone_id on public.requisitions(sub_zone_id);

alter table public.issues add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_issues_sub_zone_id on public.issues(sub_zone_id);

alter table public.tool_borrowings add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_tool_borrowings_sub_zone_id on public.tool_borrowings(sub_zone_id);

alter table public.fuel_dispenses add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_fuel_dispenses_sub_zone_id on public.fuel_dispenses(sub_zone_id);

alter table public.vehicles add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_vehicles_sub_zone_id on public.vehicles(sub_zone_id);

alter table public.profiles add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_profiles_sub_zone_id on public.profiles(sub_zone_id);

-- 3. Trigger chống leo quyền trên profiles
create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer as $$
begin
  if new.role is distinct from old.role or new.zone_id is distinct from old.zone_id or new.sub_zone_id is distinct from old.sub_zone_id then
    raise exception 'Không được tự đổi role/zone';
  end if;
  return new;
end;
$$;

-- 4. Trigger tạo profile khi tạo user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text;
begin
  v_username := nullif(trim(lower(new.raw_user_meta_data->>'username')), '');
  if v_username is null then
    v_username := lower(split_part(coalesce(new.email, ''), '@', 1));
  end if;
  insert into public.profiles (id, name, role, zone_id, sub_zone_id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'requester'),
    nullif(new.raw_user_meta_data->>'zone_id','')::uuid,
    nullif(new.raw_user_meta_data->>'sub_zone_id','')::uuid,
    v_username
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 5. RPC create_requisition
create or replace function public.create_requisition(
  p_items jsonb, p_zone_id uuid, p_purpose text, p_type public.requisition_type,
  p_linked_defect_id uuid, p_requester_id uuid, p_sub_zone_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_requester_id is distinct from auth.uid() and not public.is_manager() then
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
    insert into public.requisition_items (requisition_id, variant_id, quantity)
    values (v_id, (it.value->>'variant_id')::uuid, (it.value->>'quantity')::int);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'requisition.create', 'requisition', v_id, jsonb_build_object('status','draft'));

  return v_id;
end;
$$;

-- 6. RPC create_issue
create or replace function public.create_issue(
  p_items jsonb, p_destination_type text,
  p_zone_id uuid, p_customer_id uuid,
  p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid,
  p_sub_zone_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; it record; v_price numeric;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được lập phiếu xuất'; end if;
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

-- 7. RPC create_tool_borrowing
create or replace function public.create_tool_borrowing(
  p_items jsonb,
  p_zone_id uuid,
  p_purpose text,
  p_expected_return_date date,
  p_borrower_id uuid,
  p_sub_zone_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
  v_main_loc uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_purpose is null or length(trim(p_purpose)) = 0 then raise exception 'Mục đích mượn không được để trống'; end if;
  if p_borrower_id is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ quản lý kho mới được tạo phiếu mượn hộ người khác';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';
  v_code := public.next_code('MDC', 'public.tool_borrowings_seq'::regclass);

  insert into public.tool_borrowings (
    code, borrower_id, zone_id, sub_zone_id, purpose, expected_return_date, issued_by, status
  )
  values (
    v_code, p_borrower_id, p_zone_id, p_sub_zone_id, p_purpose, p_expected_return_date, auth.uid(), 'borrowed'
  )
  returning id into v_id;

  -- Trừ tồn kho Kho chính & ghi ledger tool_borrow_out
  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.tool_borrowing_items (borrowing_id, variant_id, quantity)
    values (v_id, (it.value->>'variant_id')::uuid, (it.value->>'quantity')::int);

    perform public._move_stock(
      (it.value->>'variant_id')::uuid,
      v_main_loc,
      null,
      (it.value->>'quantity')::int,
      'tool_borrow_out',
      'tool_borrowing',
      v_id,
      auth.uid(),
      'Xuất mượn dụng cụ: ' || p_purpose
    );
  end loop;

  return v_id;
end;
$$;

-- 8. RPC create_fuel_dispense
create or replace function public.create_fuel_dispense(
  p_vehicle_id uuid,
  p_zone_id uuid,
  p_fuel_type_id uuid,
  p_quantity numeric,
  p_current_odo numeric,
  p_driver_name text,
  p_meter_images text[],
  p_notes text,
  p_by uuid,
  p_sub_zone_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
  v_cur_stock numeric;
  v_new_stock numeric;
  v_prev_odo numeric := null;
  v_odo_unit public.fuel_calc_unit := 'km';
  v_usage_diff numeric := null;
  v_rate numeric := null;
  v_vehicle_zone uuid := null;
  v_vehicle_sub_zone uuid := null;
  v_target_zone uuid := null;
  v_target_sub_zone uuid := null;
  v_driver text := null;
begin
  if auth.uid() is null and p_by is null and auth.role() is distinct from 'service_role' and current_user != 'postgres' then
    raise exception 'Yêu cầu đăng nhập để cấp phát dầu';
  end if;
  if auth.uid() is not null then
    p_by := auth.uid();
  end if;
  if p_by is not null and not exists (select 1 from public.profiles where id = p_by and is_active = true) then
    raise exception 'Tài khoản không hợp lệ hoặc đã bị khóa';
  end if;

  if p_quantity is null or p_quantity <= 0 then raise exception 'Số lượng cấp dầu phải lớn hơn 0'; end if;

  -- Kiểm tra và khóa tồn kho
  select current_stock into v_cur_stock
  from public.fuel_types
  where id = p_fuel_type_id for update;

  if v_cur_stock is null then raise exception 'Không tìm thấy loại dầu chỉ định'; end if;
  if v_cur_stock < p_quantity then
    raise exception 'Không đủ tồn kho dầu (Tồn hiện tại: % Lít, Yêu cầu: % Lít)', v_cur_stock, p_quantity;
  end if;

  -- Nếu có xe, lấy thông tin xe
  if p_vehicle_id is not null then
    select current_odo, odo_unit, zone_id, sub_zone_id, default_driver
    into v_prev_odo, v_odo_unit, v_vehicle_zone, v_vehicle_sub_zone, v_driver
    from public.vehicles
    where id = p_vehicle_id for update;

    if p_current_odo is not null and v_prev_odo is not null and p_current_odo >= v_prev_odo then
      v_usage_diff := p_current_odo - v_prev_odo;
      if v_usage_diff > 0 then
        if v_odo_unit = 'km' then
          v_rate := round((p_quantity / v_usage_diff * 100)::numeric, 2); -- Lít / 100km
        else
          v_rate := round((p_quantity / v_usage_diff)::numeric, 2);       -- Lít / Giờ
        end if;
      end if;
    end if;
  end if;

  -- Xác định khu vực & người lái
  v_target_zone := coalesce(p_zone_id, v_vehicle_zone);
  v_target_sub_zone := coalesce(p_sub_zone_id, v_vehicle_sub_zone);
  v_driver := coalesce(nullif(trim(p_driver_name), ''), v_driver);

  v_code := public.next_code('CPD', 'public.fuel_dispenses_seq'::regclass);
  v_new_stock := v_cur_stock - p_quantity;

  -- Ghi nhận phiếu cấp phát
  insert into public.fuel_dispenses (
    code, vehicle_id, zone_id, sub_zone_id, fuel_type_id, quantity,
    prev_odo, current_odo, usage_diff, consumption_rate,
    driver_name, meter_images, notes, created_by
  ) values (
    v_code, p_vehicle_id, v_target_zone, v_target_sub_zone, p_fuel_type_id, p_quantity,
    v_prev_odo, p_current_odo, v_usage_diff, v_rate,
    v_driver, coalesce(p_meter_images, '{}'), nullif(trim(p_notes), ''), p_by
  ) returning id into v_id;

  -- Cập nhật tồn kho loại dầu
  update public.fuel_types
  set current_stock = v_new_stock, updated_at = now()
  where id = p_fuel_type_id;

  -- Cập nhật ODO xe nếu có nhập ODO mới hợp lệ
  if p_vehicle_id is not null and p_current_odo is not null and (v_prev_odo is null or p_current_odo >= v_prev_odo) then
    update public.vehicles
    set current_odo = p_current_odo, updated_at = now()
    where id = p_vehicle_id;
  end if;

  return v_id;
end;
$$;

-- 9. RPC admin_update_profile
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_name text,
  p_role text,
  p_zone_id uuid,
  p_is_active boolean,
  p_sub_zone_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được quản lý người dùng'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Tên không được trống'; end if;
  if p_role not in ('requester','manager','superuser') then raise exception 'Role không hợp lệ'; end if;
  if p_role = 'superuser' and not public.is_superuser() then
    raise exception 'Chỉ tài khoản superuser được cấp vai trò superuser';
  end if;

  update public.profiles
  set name = p_name, role = p_role, zone_id = p_zone_id, sub_zone_id = p_sub_zone_id, is_active = p_is_active
  where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'profile.update', 'profile', p_user_id,
          jsonb_build_object('role', p_role, 'zone_id', p_zone_id, 'sub_zone_id', p_sub_zone_id, 'is_active', p_is_active));
end;
$$;

-- 10. RPC list_requester_accounts
drop function if exists public.list_requester_accounts();
create or replace function public.list_requester_accounts()
returns table (id uuid, name text, username text, zone_id uuid, sub_zone_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'Chỉ quản lý kho được xem tài khoản người yêu cầu';
  end if;
  return query
    select p.id, p.name, p.username, p.zone_id, p.sub_zone_id
    from public.profiles p
    where p.role = 'requester' and p.is_active
    order by p.name;
end;
$$;
