-- 0029_username_login.sql — đăng nhập bằng tên đăng nhập (username)
-- Username nằm ở public.profiles; email nội bộ username@mtp.local cho tài khoản mới.

alter table public.profiles add column username text;

-- Backfill username từ local-part email (chuẩn hoá, xử lý trùng lặp)
do $$
declare
  r record;
  base text;
  cand text;
  n int;
begin
  for r in
    select p.id, p.created_at, lower(u.email::text) as email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username is null
    order by p.created_at, p.id
  loop
    base := lower(regexp_replace(split_part(coalesce(r.email, ''), '@', 1), '[^a-z0-9._-]', '', 'g'));
    if base = '' then
      base := 'user' || left(replace(r.id::text, '-', ''), 8);
    end if;
    if not (base ~ '^[a-z]') then
      base := 'u' || base;
    end if;
    base := left(base, 30);
    cand := base;
    n := 2;
    while exists (select 1 from public.profiles where lower(username) = lower(cand)) loop
      cand := left(base, greatest(1, 30 - length(n::text) - 1)) || '-' || n;
      n := n + 1;
    end loop;
    update public.profiles set username = cand where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column username set not null;

create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- Trigger: copy username từ user_metadata (fallback: local-part email)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text;
begin
  v_username := nullif(trim(lower(new.raw_user_meta_data->>'username')), '');
  if v_username is null then
    v_username := lower(split_part(coalesce(new.email, ''), '@', 1));
  end if;
  insert into public.profiles (id, name, role, zone_id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'requester'),
    nullif(new.raw_user_meta_data->>'zone_id','')::uuid,
    v_username
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- RPC tra email nội bộ khi đăng nhập — chỉ service_role gọi được (không lộ email qua API anon)
create or replace function public.get_login_email(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(p_username)
    and p.is_active
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
revoke all on function public.get_login_email(text) from anon, authenticated;
grant execute on function public.get_login_email(text) to service_role;

-- Đổi username (manager-only qua RLS guard; index unique chặn trùng)
create or replace function public.admin_update_username(p_user_id uuid, p_username text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được quản lý người dùng'; end if;
  if p_username is null or length(trim(p_username)) = 0 or p_username !~ '^[a-z][a-z0-9._-]{2,29}$' then
    raise exception 'Tên đăng nhập không hợp lệ';
  end if;
  update public.profiles set username = lower(trim(p_username)) where id = p_user_id;
end;
$$;

-- list_requester_accounts: trả username thay email (đổi kiểu trả về → phải drop trước)
drop function if exists public.list_requester_accounts();
create or replace function public.list_requester_accounts()
returns table (id uuid, name text, username text, zone_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'Chỉ quản lý kho được xem tài khoản người yêu cầu';
  end if;
  return query
    select p.id, p.name, p.username, p.zone_id
    from public.profiles p
    where p.role = 'requester' and p.is_active
    order by p.name;
end;
$$;
