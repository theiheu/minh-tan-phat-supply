-- 0065_roles_and_permissions.sql — Hệ thống phân quyền 7 vai trò chuẩn hóa cho trang trại MTP

-- 1. Gỡ bỏ check constraint cũ trước
alter table public.profiles drop constraint if exists profiles_role_check;

-- 2. Chuyển đổi toàn bộ tài khoản manager cũ sang role warehouse (Quản kho)
update public.profiles set role = 'warehouse' where role = 'manager';

-- 3. Tạo lại check constraint với 7 vai trò chuẩn hóa
alter table public.profiles add constraint profiles_role_check
  check (role in ('superuser', 'owner', 'accountant', 'warehouse', 'technician', 'requester', 'driver'));

-- 4. is_manager(): Quản lý cấp cao, Kế toán, Quản kho hoặc Superuser đang hoạt động
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('warehouse', 'owner', 'accountant', 'superuser') and is_active
  );
$$;

-- 5. is_warehouse(): Quản kho, Chủ trại hoặc Superuser
create or replace function public.is_warehouse() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('warehouse', 'owner', 'superuser') and is_active
  );
$$;

-- 6. is_technician(): Kỹ thuật (Quản lý khu), Quản kho, Chủ trại hoặc Superuser
create or replace function public.is_technician() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('technician', 'warehouse', 'owner', 'superuser') and is_active
  );
$$;

-- 7. is_accountant(): Kế toán, Chủ trại hoặc Superuser
create or replace function public.is_accountant() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('accountant', 'owner', 'superuser') and is_active
  );
$$;

-- 8. is_owner(): Chủ trại hoặc Superuser
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'superuser') and is_active
  );
$$;

-- 9. Cập nhật RPC admin_update_profile hỗ trợ đầy đủ 7 vai trò chuẩn hóa
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_name text,
  p_role text,
  p_zone_id uuid,
  p_is_active boolean,
  p_sub_zone_id uuid default null,
  p_email text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý được quản lý người dùng'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Tên không được trống'; end if;
  if p_role not in ('superuser', 'owner', 'accountant', 'warehouse', 'technician', 'requester', 'driver') then
    raise exception 'Role không hợp lệ: %', p_role;
  end if;
  -- Chỉ superuser được cấp/gỡ vai trò superuser
  if p_role = 'superuser' and not public.is_superuser() then
    raise exception 'Chỉ tài khoản superuser được cấp vai trò superuser';
  end if;

  update public.profiles
  set name = p_name,
      role = p_role,
      zone_id = p_zone_id,
      sub_zone_id = p_sub_zone_id,
      email = nullif(trim(lower(p_email)), ''),
      is_active = p_is_active,
      updated_at = now()
  where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'profile.update', 'profile', p_user_id,
          jsonb_build_object('role', p_role, 'zone_id', p_zone_id, 'sub_zone_id', p_sub_zone_id, 'email', p_email, 'is_active', p_is_active));
end;
$$;
