-- 0063_user_email_notifications.sql — Gán email vào người dùng & cấu hình gửi thông báo email

-- 1. Thêm cột email vào bảng profiles
alter table public.profiles add column if not exists email text;

-- 2. Backfill email từ auth.users cho các tài khoản không dùng email nội bộ (@mtp.local)
update public.profiles p
set email = lower(trim(u.email::text))
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null
  and lower(u.email::text) not like '%@mtp.local';

-- 3. Cập nhật trigger handle_new_user để lưu email
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text;
  v_email text;
begin
  v_username := nullif(trim(lower(new.raw_user_meta_data->>'username')), '');
  if v_username is null then
    v_username := lower(split_part(coalesce(new.email, ''), '@', 1));
  end if;

  v_email := nullif(trim(lower(new.raw_user_meta_data->>'email')), '');
  if v_email is null and new.email is not null and lower(new.email::text) not like '%@mtp.local' then
    v_email := lower(trim(new.email::text));
  end if;

  insert into public.profiles (id, name, role, zone_id, sub_zone_id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'requester'),
    nullif(new.raw_user_meta_data->>'zone_id','')::uuid,
    nullif(new.raw_user_meta_data->>'sub_zone_id','')::uuid,
    v_username,
    v_email
  )
  on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email);
  return new;
end;
$$;

-- 4. Cập nhật RPC admin_update_profile hỗ trợ p_email
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
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được quản lý người dùng'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Tên không được trống'; end if;
  if p_role not in ('requester','manager','superuser') then raise exception 'Role không hợp lệ'; end if;
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

-- 5. Cập nhật RPC list_requester_accounts trả thêm email
drop function if exists public.list_requester_accounts();
create or replace function public.list_requester_accounts()
returns table (id uuid, name text, username text, zone_id uuid, sub_zone_id uuid, email text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'Chỉ quản lý kho được xem tài khoản người yêu cầu';
  end if;
  return query
    select p.id, p.name, p.username, p.zone_id, p.sub_zone_id, p.email
    from public.profiles p
    where p.role = 'requester' and p.is_active
    order by p.name;
end;
$$;
