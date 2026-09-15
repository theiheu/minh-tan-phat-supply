-- 0066_immutable_user_identity.sql — Khóa bất biến Họ tên và Tên đăng nhập sau khi tạo tài khoản

-- 1. Trigger chặn thay đổi name và username trên public.profiles
create or replace function public.prevent_profile_identity_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Nếu name đã có giá trị và bị thay đổi khác rỗng -> chặn
  if old.name is not null and new.name is distinct from old.name then
    raise exception 'Họ và tên người dùng không thể thay đổi sau khi đã tạo';
  end if;

  -- Nếu username đã có giá trị và bị thay đổi khác rỗng -> chặn
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'Tên đăng nhập không thể thay đổi sau khi đã tạo';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_prevent_identity_change on public.profiles;

create trigger trg_profiles_prevent_identity_change
  before update on public.profiles
  for each row execute function public.prevent_profile_identity_change();

-- 2. Cập nhật RPC admin_update_profile: giữ nguyên name gốc, không cho phép đổi
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_name text,
  p_role text,
  p_zone_id uuid,
  p_is_active boolean,
  p_sub_zone_id uuid default null,
  p_email text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_existing_name text;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý được quản lý người dùng'; end if;
  if p_role not in ('superuser', 'owner', 'accountant', 'warehouse', 'technician', 'requester', 'driver') then
    raise exception 'Role không hợp lệ: %', p_role;
  end if;
  -- Chỉ superuser được cấp/gỡ vai trò superuser
  if p_role = 'superuser' and not public.is_superuser() then
    raise exception 'Chỉ tài khoản superuser được cấp vai trò superuser';
  end if;

  select name into v_existing_name from public.profiles where id = p_user_id;

  update public.profiles
  set role = p_role,
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

-- 3. Cập nhật RPC admin_update_username: chặn đổi username
create or replace function public.admin_update_username(
  p_user_id uuid,
  p_username text
) returns void language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Tên đăng nhập không thể thay đổi sau khi đã tạo';
end;
$$;
