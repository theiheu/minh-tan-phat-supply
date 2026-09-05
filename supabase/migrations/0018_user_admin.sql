-- 0018_user_admin.sql — quản lý người dùng (đổi role/zone/vô hiệu hóa) qua RPC manager-only
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
  if p_role not in ('requester','manager') then raise exception 'Role không hợp lệ'; end if;

  update public.profiles
  set name = p_name, role = p_role, zone_id = p_zone_id, is_active = p_is_active
  where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'profile.update', 'profile', p_user_id,
          jsonb_build_object('role', p_role, 'zone_id', p_zone_id, 'is_active', p_is_active));
end;
$$;
