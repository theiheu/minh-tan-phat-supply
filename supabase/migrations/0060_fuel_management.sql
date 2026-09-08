-- 0060_fuel_management.sql — Phân hệ Quản lý Kho Dầu (Nhiên liệu, Xe, Nhập, Xuất/Cấp phát, Sổ cái)

-- 1. Sequences sinh mã phiếu
create sequence if not exists public.fuel_receipts_seq;
create sequence if not exists public.fuel_dispenses_seq;

-- 2. Types / Enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'vehicle_type') then
    create type public.vehicle_type as enum (
      'truck', 'excavator', 'generator', 'car', 'forklift', 'tractor', 'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'fuel_calc_unit') then
    create type public.fuel_calc_unit as enum ('km', 'hours');
  end if;
  if not exists (select 1 from pg_type where typname = 'fuel_movement_type') then
    create type public.fuel_movement_type as enum (
      'receipt_in', 'dispense_out', 'adjustment_in', 'adjustment_out', 'cancel_revert'
    );
  end if;
end $$;

-- 3. Bảng fuel_types (Danh mục Loại Dầu / Nhiên liệu / Nhớt)
create table if not exists public.fuel_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null default 'lít',
  current_stock numeric(12,2) not null default 0 check (current_stock >= 0),
  min_stock numeric(12,2) not null default 0,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Bảng vehicles (Danh mục Phương tiện & Máy móc)
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type public.vehicle_type not null default 'truck',
  zone_id uuid references public.zones(id) on delete set null,
  default_driver text,
  fuel_type_id uuid references public.fuel_types(id) on delete restrict,
  current_odo numeric(12,2) not null default 0,
  odo_unit public.fuel_calc_unit not null default 'km',
  fuel_norm numeric(10,2),
  qr_token text not null unique,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Bảng fuel_receipts (Phiếu Nhập Dầu)
create table if not exists public.fuel_receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  supplier_id uuid references public.suppliers(id) on delete restrict,
  fuel_type_id uuid not null references public.fuel_types(id) on delete restrict,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  invoice_number text,
  invoice_images text[] not null default '{}',
  received_by uuid not null references public.profiles(id),
  notes text,
  status text not null default 'completed' check (status in ('draft', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Bảng fuel_dispenses (Phiếu Cấp phát / Xuất Dầu)
create table if not exists public.fuel_dispenses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  zone_id uuid references public.zones(id) on delete set null,
  fuel_type_id uuid not null references public.fuel_types(id) on delete restrict,
  quantity numeric(12,2) not null check (quantity > 0),
  previous_odo numeric(12,2),
  current_odo numeric(12,2),
  usage_diff numeric(12,2),
  consumption_rate numeric(10,2),
  driver_name text,
  dispenser_id uuid not null references public.profiles(id),
  meter_images text[] not null default '{}',
  notes text,
  status text not null default 'completed' check (status in ('draft', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Bảng fuel_movements (Sổ cái Thẻ kho Dầu)
create table if not exists public.fuel_movements (
  id uuid primary key default gen_random_uuid(),
  fuel_type_id uuid not null references public.fuel_types(id),
  movement_type public.fuel_movement_type not null,
  quantity numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  ref_type text not null,
  ref_id uuid not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 8. Indexes
create index if not exists idx_vehicles_zone on public.vehicles(zone_id);
create index if not exists idx_vehicles_qr on public.vehicles(qr_token);
create index if not exists idx_fuel_receipts_date on public.fuel_receipts(created_at desc);
create index if not exists idx_fuel_receipts_fuel_type on public.fuel_receipts(fuel_type_id);
create index if not exists idx_fuel_dispenses_date on public.fuel_dispenses(created_at desc);
create index if not exists idx_fuel_dispenses_vehicle on public.fuel_dispenses(vehicle_id);
create index if not exists idx_fuel_dispenses_zone on public.fuel_dispenses(zone_id);
create index if not exists idx_fuel_movements_type_date on public.fuel_movements(fuel_type_id, created_at desc);

-- 9. Row Level Security (RLS)
alter table public.fuel_types enable row level security;
alter table public.vehicles enable row level security;
alter table public.fuel_receipts enable row level security;
alter table public.fuel_dispenses enable row level security;
alter table public.fuel_movements enable row level security;

-- Policies: Cho phép mọi tài khoản đã đăng nhập xem dữ liệu
drop policy if exists "fuel_types_select" on public.fuel_types;
create policy "fuel_types_select" on public.fuel_types for select to authenticated using (true);

drop policy if exists "fuel_types_all_mgr" on public.fuel_types;
create policy "fuel_types_all_mgr" on public.fuel_types for all to authenticated using (public.is_manager());

drop policy if exists "vehicles_select" on public.vehicles;
create policy "vehicles_select" on public.vehicles for select to authenticated using (true);

drop policy if exists "vehicles_all_mgr" on public.vehicles;
create policy "vehicles_all_mgr" on public.vehicles for all to authenticated using (public.is_manager());

drop policy if exists "fuel_receipts_select" on public.fuel_receipts;
create policy "fuel_receipts_select" on public.fuel_receipts for select to authenticated using (true);

drop policy if exists "fuel_receipts_all_mgr" on public.fuel_receipts;
create policy "fuel_receipts_all_mgr" on public.fuel_receipts for all to authenticated using (public.is_manager());

drop policy if exists "fuel_dispenses_select" on public.fuel_dispenses;
create policy "fuel_dispenses_select" on public.fuel_dispenses for select to authenticated using (true);

drop policy if exists "fuel_dispenses_all_mgr" on public.fuel_dispenses;
create policy "fuel_dispenses_all_mgr" on public.fuel_dispenses for all to authenticated using (public.is_manager());

drop policy if exists "fuel_movements_select" on public.fuel_movements;
create policy "fuel_movements_select" on public.fuel_movements for select to authenticated using (true);

drop policy if exists "fuel_movements_all_mgr" on public.fuel_movements;
create policy "fuel_movements_all_mgr" on public.fuel_movements for all to authenticated using (public.is_manager());

-- 10. Stored Procedures / RPCs

-- A. Nhập kho dầu
create or replace function public.create_fuel_receipt(
  p_supplier_id uuid,
  p_fuel_type_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_invoice_number text,
  p_invoice_images text[],
  p_notes text,
  p_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
  v_new_stock numeric;
  v_unit_price numeric;
  v_total_amount numeric;
begin
  if not public.is_manager() and auth.role() is distinct from 'service_role' and current_user != 'postgres' then
    raise exception 'Chỉ quản lý mới được lập phiếu nhập dầu';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Số lượng nhập phải lớn hơn 0'; end if;
  if auth.uid() is not null then
    p_by := auth.uid();
  end if;

  v_unit_price := coalesce(p_unit_price, 0);
  v_total_amount := p_quantity * v_unit_price;
  v_code := public.next_code('NKD', 'public.fuel_receipts_seq'::regclass);

  -- Khóa và tăng tồn kho
  update public.fuel_types
  set current_stock = current_stock + p_quantity, updated_at = now()
  where id = p_fuel_type_id
  returning current_stock into v_new_stock;

  if v_new_stock is null then raise exception 'Không tìm thấy loại dầu'; end if;

  insert into public.fuel_receipts (
    code, supplier_id, fuel_type_id, quantity, unit_price, total_amount,
    invoice_number, invoice_images, received_by, notes, status
  ) values (
    v_code, p_supplier_id, p_fuel_type_id, p_quantity, v_unit_price, v_total_amount,
    nullif(trim(p_invoice_number), ''), coalesce(p_invoice_images, '{}'), p_by, nullif(trim(p_notes), ''), 'completed'
  ) returning id into v_id;

  -- Ghi sổ cái
  insert into public.fuel_movements (
    fuel_type_id, movement_type, quantity, balance_after, ref_type, ref_id, notes, created_by
  ) values (
    p_fuel_type_id, 'receipt_in', p_quantity, v_new_stock, 'fuel_receipts', v_id,
    'Nhập kho dầu: ' || v_code, p_by
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'fuel_receipt.create', 'fuel_receipt', v_id, jsonb_build_object('code', v_code, 'qty', p_quantity));

  return v_id;
end;
$$;

-- B. Cấp phát / Xuất dầu
create or replace function public.create_fuel_dispense(
  p_vehicle_id uuid,
  p_zone_id uuid,
  p_fuel_type_id uuid,
  p_quantity numeric,
  p_current_odo numeric,
  p_driver_name text,
  p_meter_images text[],
  p_notes text,
  p_by uuid
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
  v_target_zone uuid := null;
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
    select current_odo, odo_unit, zone_id, default_driver
    into v_prev_odo, v_odo_unit, v_vehicle_zone, v_driver
    from public.vehicles
    where id = p_vehicle_id for update;

    if p_current_odo is not null and v_prev_odo is not null and p_current_odo >= v_prev_odo then
      v_usage_diff := p_current_odo - v_prev_odo;
      if v_usage_diff > 0 then
        if v_odo_unit = 'km' then
          v_rate := round((p_quantity / v_usage_diff * 100)::numeric, 2); -- Lít / 100km
        else
          v_rate := round((p_quantity / v_usage_diff)::numeric, 2); -- Lít / giờ
        end if;
      end if;

      -- Cập nhật Odo mới cho xe
      update public.vehicles
      set current_odo = p_current_odo, updated_at = now()
      where id = p_vehicle_id;
    end if;
  end if;

  v_target_zone := coalesce(p_zone_id, v_vehicle_zone);
  v_driver := coalesce(nullif(trim(p_driver_name), ''), v_driver);

  -- Trừ tồn kho
  update public.fuel_types
  set current_stock = current_stock - p_quantity, updated_at = now()
  where id = p_fuel_type_id
  returning current_stock into v_new_stock;

  v_code := public.next_code('CKD', 'public.fuel_dispenses_seq'::regclass);

  insert into public.fuel_dispenses (
    code, vehicle_id, zone_id, fuel_type_id, quantity,
    previous_odo, current_odo, usage_diff, consumption_rate,
    driver_name, dispenser_id, meter_images, notes, status
  ) values (
    v_code, p_vehicle_id, v_target_zone, p_fuel_type_id, p_quantity,
    v_prev_odo, p_current_odo, v_usage_diff, v_rate,
    v_driver, p_by, coalesce(p_meter_images, '{}'), nullif(trim(p_notes), ''), 'completed'
  ) returning id into v_id;

  -- Ghi sổ cái
  insert into public.fuel_movements (
    fuel_type_id, movement_type, quantity, balance_after, ref_type, ref_id, notes, created_by
  ) values (
    p_fuel_type_id, 'dispense_out', p_quantity, v_new_stock, 'fuel_dispenses', v_id,
    'Cấp phát dầu: ' || v_code, p_by
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'fuel_dispense.create', 'fuel_dispense', v_id, jsonb_build_object('code', v_code, 'qty', p_quantity));

  return v_id;
end;
$$;

-- C. Hủy phiếu cấp phát dầu (Hoàn lại kho)
create or replace function public.cancel_fuel_dispense(
  p_id uuid,
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_dispense record;
  v_new_stock numeric;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý mới được hủy phiếu cấp phát dầu'; end if;

  select * into v_dispense from public.fuel_dispenses where id = p_id for update;
  if v_dispense.id is null then raise exception 'Không tìm thấy phiếu cấp dầu'; end if;
  if v_dispense.status = 'cancelled' then raise exception 'Phiếu cấp dầu đã bị hủy trước đó'; end if;

  -- Hoàn lại tồn kho
  update public.fuel_types
  set current_stock = current_stock + v_dispense.quantity, updated_at = now()
  where id = v_dispense.fuel_type_id
  returning current_stock into v_new_stock;

  update public.fuel_dispenses
  set status = 'cancelled', updated_at = now()
  where id = p_id;

  -- Ghi sổ cái
  insert into public.fuel_movements (
    fuel_type_id, movement_type, quantity, balance_after, ref_type, ref_id, notes, created_by
  ) values (
    v_dispense.fuel_type_id, 'cancel_revert', v_dispense.quantity, v_new_stock,
    'fuel_dispenses', p_id, 'Hủy phiếu cấp phát: ' || v_dispense.code, p_by
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'fuel_dispense.cancel', 'fuel_dispense', p_id, jsonb_build_object('code', v_dispense.code));
end;
$$;

-- D. Hủy phiếu nhập dầu (Trừ lại kho)
create or replace function public.cancel_fuel_receipt(
  p_id uuid,
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_receipt record;
  v_cur_stock numeric;
  v_new_stock numeric;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý mới được hủy phiếu nhập dầu'; end if;

  select * into v_receipt from public.fuel_receipts where id = p_id for update;
  if v_receipt.id is null then raise exception 'Không tìm thấy phiếu nhập dầu'; end if;
  if v_receipt.status = 'cancelled' then raise exception 'Phiếu nhập dầu đã bị hủy trước đó'; end if;

  select current_stock into v_cur_stock from public.fuel_types where id = v_receipt.fuel_type_id for update;
  if v_cur_stock < v_receipt.quantity then
    raise exception 'Không thể hủy phiếu nhập vì tồn kho hiện tại (%) nhỏ hơn số lượng nhập cần trừ lại (%)', v_cur_stock, v_receipt.quantity;
  end if;

  update public.fuel_types
  set current_stock = current_stock - v_receipt.quantity, updated_at = now()
  where id = v_receipt.fuel_type_id
  returning current_stock into v_new_stock;

  update public.fuel_receipts
  set status = 'cancelled', updated_at = now()
  where id = p_id;

  insert into public.fuel_movements (
    fuel_type_id, movement_type, quantity, balance_after, ref_type, ref_id, notes, created_by
  ) values (
    v_receipt.fuel_type_id, 'cancel_revert', -v_receipt.quantity, v_new_stock,
    'fuel_receipts', p_id, 'Hủy phiếu nhập: ' || v_receipt.code, p_by
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'fuel_receipt.cancel', 'fuel_receipt', p_id, jsonb_build_object('code', v_receipt.code));
end;
$$;

-- E. Tìm kiếm thông tin xe theo QR token hoặc Biển số xe
create or replace function public.get_vehicle_by_qr(p_qr_text text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_veh record;
  v_last_dispense record;
begin
  if auth.uid() is null and auth.role() is distinct from 'service_role' and current_user != 'postgres' then
    raise exception 'Yêu cầu đăng nhập để xem thông tin phương tiện';
  end if;

  if p_qr_text is null or length(trim(p_qr_text)) = 0 then
    return null;
  end if;

  select v.*, z.name as zone_name, ft.name as fuel_type_name, ft.code as fuel_type_code, ft.unit as fuel_unit
  into v_veh
  from public.vehicles v
  left join public.zones z on z.id = v.zone_id
  left join public.fuel_types ft on ft.id = v.fuel_type_id
  where v.qr_token = trim(p_qr_text)
     or upper(v.code) = upper(trim(p_qr_text))
  limit 1;

  if v_veh.id is null then
    return null;
  end if;

  select code, quantity, current_odo, consumption_rate, created_at
  into v_last_dispense
  from public.fuel_dispenses
  where vehicle_id = v_veh.id and status = 'completed'
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'id', v_veh.id,
    'code', v_veh.code,
    'name', v_veh.name,
    'type', v_veh.type,
    'zone_id', v_veh.zone_id,
    'zone_name', v_veh.zone_name,
    'default_driver', v_veh.default_driver,
    'fuel_type_id', v_veh.fuel_type_id,
    'fuel_type_name', v_veh.fuel_type_name,
    'fuel_type_code', v_veh.fuel_type_code,
    'fuel_unit', v_veh.fuel_unit,
    'current_odo', v_veh.current_odo,
    'odo_unit', v_veh.odo_unit,
    'fuel_norm', v_veh.fuel_norm,
    'qr_token', v_veh.qr_token,
    'is_active', v_veh.is_active,
    'last_dispense', case when v_last_dispense.code is not null then
      jsonb_build_object(
        'code', v_last_dispense.code,
        'quantity', v_last_dispense.quantity,
        'current_odo', v_last_dispense.current_odo,
        'consumption_rate', v_last_dispense.consumption_rate,
        'created_at', v_last_dispense.created_at
      ) else null end
  );
end;
$$;

-- 11. Seed initial fuel types & vehicles
insert into public.fuel_types (code, name, unit, current_stock, min_stock, description)
values
  ('DIESEL_DO_005', 'Dầu Diesel (DO 0.05S-II)', 'lít', 2500.00, 500.00, 'Dầu chạy xe tải, xe xúc, máy phát điện'),
  ('HYDRAULIC_68', 'Dầu thủy lực ISO VG 68', 'lít', 400.00, 100.00, 'Dầu thủy lực cho ben xe và tay đòn xe xúc'),
  ('ENGINE_OIL_15W40', 'Nhớt động cơ Caltex 15W40', 'lít', 200.00, 60.00, 'Nhớt bôi trơn động cơ diesel'),
  ('RON_95', 'Xăng RON 95-III', 'lít', 150.00, 50.00, 'Xăng xe máy công vụ và máy cắt cỏ')
on conflict (code) do update set
  name = excluded.name,
  unit = excluded.unit,
  description = excluded.description;

-- Seed vehicles (liên kết với Dầu Diesel DO 0.05S)
do $$
declare
  v_diesel_id uuid;
  v_zone1_id uuid;
begin
  select id into v_diesel_id from public.fuel_types where code = 'DIESEL_DO_005' limit 1;
  select id into v_zone1_id from public.zones order by name limit 1;

  if v_diesel_id is not null then
    insert into public.vehicles (code, name, type, zone_id, default_driver, fuel_type_id, current_odo, odo_unit, fuel_norm, qr_token, notes)
    values
      ('61C-123.45', 'Xe ben Howo 4 chân 371HP', 'truck', v_zone1_id, 'Nguyễn Văn Hùng', v_diesel_id, 45200.00, 'km', 35.00, 'VEH_61C12345_HOWO', 'Xe chở cám và phân trại'),
      ('61C-678.90', 'Xe tải Hino 5 tấn thùng kín', 'truck', v_zone1_id, 'Trần Minh Tâm', v_diesel_id, 89400.00, 'km', 18.00, 'VEH_61C67890_HINO', 'Xe giao trứng'),
      ('MAY-XUC-01', 'Xe đào bánh xích Komatsu PC200-8', 'excavator', v_zone1_id, 'Lê Văn Thắng', v_diesel_id, 3450.00, 'hours', 14.00, 'VEH_KOMATSU_PC200', 'Máy xúc dọn chuồng trại'),
      ('MAY-PHAT-01', 'Máy phát điện Cummins 500kVA', 'generator', v_zone1_id, 'Phạm Quốc Bảo', v_diesel_id, 1200.00, 'hours', 45.00, 'VEH_MPD_CUMMINS', 'Máy phát dự phòng trại gà')
    on conflict (code) do nothing;
  end if;
end $$;

-- 12. Permissions
revoke all on function public.create_fuel_receipt from public;
grant execute on function public.create_fuel_receipt to authenticated;

revoke all on function public.create_fuel_dispense from public;
grant execute on function public.create_fuel_dispense to authenticated;

revoke all on function public.cancel_fuel_dispense from public;
grant execute on function public.cancel_fuel_dispense to authenticated;

revoke all on function public.cancel_fuel_receipt from public;
grant execute on function public.cancel_fuel_receipt to authenticated;

revoke all on function public.get_vehicle_by_qr from public;
grant execute on function public.get_vehicle_by_qr to authenticated;

