-- Migration: 0093_auth_user_created_trigger.sql
-- Ensure handle_new_user trigger is up to date and attached to auth.users

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
  set
    name = coalesce(excluded.name, public.profiles.name),
    role = coalesce(excluded.role, public.profiles.role),
    zone_id = coalesce(excluded.zone_id, public.profiles.zone_id),
    sub_zone_id = coalesce(excluded.sub_zone_id, public.profiles.sub_zone_id),
    username = coalesce(excluded.username, public.profiles.username),
    email = coalesce(excluded.email, public.profiles.email);
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
