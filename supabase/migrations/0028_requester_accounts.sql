-- 0028_requester_accounts.sql — liệt kê tài khoản người yêu cầu (kèm email) cho manager
-- dùng khi tạo phiếu yêu cầu dùm. security definer + chặn chỉ manager.
create or replace function public.list_requester_accounts()
returns table (id uuid, name text, email text, zone_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'Chỉ quản lý kho được xem tài khoản người yêu cầu';
  end if;
  return query
    select p.id, p.name, u.email::text, p.zone_id
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'requester' and p.is_active
    order by p.name;
end;
$$;
