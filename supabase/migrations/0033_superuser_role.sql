-- 0033_superuser_role.sql — vai trò superuser (toàn quyền) + tài khoản hệ thống không thể xóa
--
-- 1) Mở rộng check role profiles cho phép 'superuser'.
-- 2) Cột is_protected đánh dấu tài khoản hệ thống: không cho xóa / khóa / hạ quyền.
-- 3) is_manager() trả true cho cả manager lẫn superuser (superuser = toàn quyền manager,
--    mọi RLS/RPC manager-only hiện có tự áp dụng).
-- 4) is_superuser() + chặn role='superuser' bị quản lý cấp dưới chỉnh qua admin RPC.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('requester','manager','superuser'));

alter table public.profiles add column is_protected boolean not null default false;

-- is_manager(): manager HOẶC superuser đang hoạt động → toàn bộ RLS/RPC manager-only mở cho superuser.
create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('manager','superuser') and is_active
  );
$$;

-- is_superuser(): chỉ tài khoản superuser đang hoạt động.
create or replace function public.is_superuser() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superuser' and is_active
  );
$$;

-- ---------------------------------------------------------------------------
-- Bảo vệ tài khoản hệ thống (is_protected): không cho xóa / khóa / hạ quyền / sửa username.
-- Mọi đường ghi (admin RPC, trigger auth, SQL trực tiếp) đều qua trigger này.
-- ---------------------------------------------------------------------------
create or replace function public.protect_system_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_target_username text;
begin
  select username into v_target_username from public.profiles where id = old.id;
  v_target_username := coalesce(v_target_username, '(không tên)');

  if not old.is_protected then
    -- Không phải tài khoản hệ thống: chỉ chặn kẻ không phải superuser gán role superuser.
    -- auth.uid() is null = đường setup/service role (không thể qua RLS anon) → cho phép.
    if tg_op = 'UPDATE' and new.role = 'superuser' and old.role is distinct from 'superuser'
       and not public.is_superuser() and auth.uid() is not null then
      raise exception 'Chỉ tài khoản superuser được cấp vai trò superuser';
    end if;
    if tg_op = 'UPDATE' and new.is_protected and not public.is_superuser() and auth.uid() is not null then
      raise exception 'Chỉ tài khoản superuser được đánh dấu tài khoản hệ thống';
    end if;
    return coalesce(new, old);
  end if;

  -- Đây là tài khoản hệ thống:
  if tg_op = 'DELETE' then
    raise exception 'Không thể xóa tài khoản hệ thống %', v_target_username;
  end if;
  if new.role is distinct from 'superuser' then
    raise exception 'Không thể hạ quyền tài khoản hệ thống %', v_target_username;
  end if;
  if new.is_active is distinct from true then
    raise exception 'Không thể khóa tài khoản hệ thống %', v_target_username;
  end if;
  if new.is_protected is distinct from true then
    raise exception 'Không thể gỡ bảo vệ tài khoản hệ thống %', v_target_username;
  end if;
  if new.username is distinct from old.username then
    raise exception 'Không thể đổi tên đăng nhập tài khoản hệ thống %', v_target_username;
  end if;
  if new.id is distinct from old.id then
    raise exception 'Không thể đổi id tài khoản hệ thống';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_protect_system_account
  before update or delete on public.profiles
  for each row execute function public.protect_system_account();

-- ---------------------------------------------------------------------------
-- admin_update_profile: superuser vẫn quản lý được người dùng; trigger phía trên
-- đã chặn hạ quyền/khóa/xóa tài khoản hệ thống. Thêm chặn: manager không được
-- tự nâng bản thân/người khác lên superuser qua RPC (trigger cũng chặn, chặn 2 lớp).
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_name text,
  p_role text,
  p_zone_id uuid,
  p_is_active boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được quản lý người dùng'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Tên không được trống'; end if;
  if p_role not in ('requester','manager','superuser') then raise exception 'Role không hợp lệ'; end if;
  -- Chỉ superuser được cấp/gỡ vai trò superuser (chặn sớm, thân thiện hơn trigger).
  if p_role = 'superuser' and not public.is_superuser() then
    raise exception 'Chỉ tài khoản superuser được cấp vai trò superuser';
  end if;

  update public.profiles
  set name = p_name, role = p_role, zone_id = p_zone_id, is_active = p_is_active
  where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'profile.update', 'profile', p_user_id,
          jsonb_build_object('role', p_role, 'zone_id', p_zone_id, 'is_active', p_is_active));
end;
$$;

-- username của tài khoản hệ thống cũng không đổi (trigger chặn khi is_protected).
