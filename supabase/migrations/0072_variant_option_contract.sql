-- 0072_variant_option_contract.sql
-- Canonical ordered option contract, semantic uniqueness and atomic writes.

create or replace function public.canonical_variant_attributes(p_attributes jsonb)
returns text
language sql
immutable
strict
parallel safe
as $$
  select coalesce(string_agg(lower(btrim(entry.key)) || '=' || lower(btrim(entry.value)), E'\x1f' order by lower(btrim(entry.key))), '')
  from jsonb_each_text(p_attributes) entry
$$;

do $$
declare
  v_duplicates text;
begin
  select string_agg(format('%s (%s)', p.name, d.product_id), ', ')
  into v_duplicates
  from (
    select product_id, public.canonical_variant_attributes(attributes) as canonical_key
    from public.variants
    group by product_id, public.canonical_variant_attributes(attributes)
    having count(*) > 1
  ) d
  join public.products p on p.id = d.product_id;
  if v_duplicates is not null then
    raise exception 'Không thể bật hợp đồng biến thể vì có tổ hợp trùng: %', v_duplicates;
  end if;
end $$;

drop index if exists public.variants_product_attributes_unique;
create unique index variants_product_attributes_unique
  on public.variants (product_id, public.canonical_variant_attributes(attributes));

create or replace function public._validate_variant_attributes(
  p_options text[],
  p_attributes jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_option text;
  v_result jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_attributes) <> 'object' then
    raise exception 'Thuộc tính biến thể phải là object';
  end if;
  if (select count(*) from jsonb_object_keys(p_attributes)) <> coalesce(array_length(p_options, 1), 0) then
    raise exception 'Thuộc tính biến thể không khớp cấu trúc vật tư';
  end if;
  foreach v_option in array coalesce(p_options, array[]::text[]) loop
    if not (p_attributes ? v_option) then raise exception 'Còn thiếu %', v_option; end if;
    if btrim(coalesce(p_attributes ->> v_option, '')) = '' then raise exception 'Còn thiếu %', v_option; end if;
    v_result := v_result || jsonb_build_object(v_option, btrim(p_attributes ->> v_option));
  end loop;
  return v_result;
end;
$$;

drop function if exists public.update_product_options(uuid, text[], text[]);

create or replace function public.update_product_options(
  p_product_id uuid,
  p_old_options text[],
  p_new_options text[],
  p_source_options text[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_options text[];
  v_normalized text[] := array[]::text[];
  v_sources text[] := array[]::text[];
  v_option text;
  v_variant record;
  v_attrs jsonb;
  v_idx integer;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được sửa cấu trúc biến thể'; end if;
  select options into v_current_options from public.products where id = p_product_id for update;
  if not found then raise exception 'Không tìm thấy vật tư'; end if;
  if v_current_options is distinct from p_old_options then raise exception 'Cấu trúc biến thể đã thay đổi; hãy tải lại và thử lại'; end if;
  if coalesce(array_length(p_new_options, 1), 0) > 3 then raise exception 'Chỉ hỗ trợ tối đa 3 nhóm lựa chọn'; end if;
  if coalesce(array_length(p_new_options, 1), 0) <> coalesce(array_length(p_old_options, 1), 0)
     or coalesce(array_length(p_source_options, 1), 0) <> coalesce(array_length(p_old_options, 1), 0) then
    raise exception 'Không thể thêm hoặc xóa nhóm lựa chọn khi vật tư đã có biến thể';
  end if;

  foreach v_option in array coalesce(p_new_options, array[]::text[]) loop
    v_option := btrim(v_option);
    if v_option = '' then raise exception 'Tên nhóm lựa chọn không được để trống'; end if;
    if exists (select 1 from unnest(v_normalized) x where lower(x) = lower(v_option)) then raise exception 'Tên nhóm lựa chọn không được trùng nhau'; end if;
    v_normalized := array_append(v_normalized, v_option);
  end loop;
  foreach v_option in array coalesce(p_source_options, array[]::text[]) loop
    if not (v_option = any(p_old_options)) then raise exception 'Nguồn nhóm lựa chọn không hợp lệ: %', v_option; end if;
    if v_option = any(v_sources) then raise exception 'Nguồn nhóm lựa chọn bị trùng: %', v_option; end if;
    v_sources := array_append(v_sources, v_option);
  end loop;

  for v_variant in select id, attributes from public.variants where product_id = p_product_id for update loop
    v_attrs := '{}'::jsonb;
    for v_idx in 1..coalesce(array_length(v_normalized, 1), 0) loop
      if not (v_variant.attributes ? v_sources[v_idx]) then raise exception 'Biến thể % còn thiếu %', v_variant.id, v_sources[v_idx]; end if;
      if btrim(coalesce(v_variant.attributes ->> v_sources[v_idx], '')) = '' then raise exception 'Biến thể % còn thiếu giá trị %', v_variant.id, v_sources[v_idx]; end if;
      v_attrs := v_attrs || jsonb_build_object(v_normalized[v_idx], btrim(v_variant.attributes ->> v_sources[v_idx]));
    end loop;
    update public.variants set attributes = v_attrs, updated_at = now() where id = v_variant.id;
  end loop;
  update public.products set options = v_normalized, updated_at = now() where id = p_product_id;
end;
$$;

create or replace function public.create_variant_with_contract(
  p_product_id uuid,
  p_attributes jsonb,
  p_price numeric,
  p_unit text,
  p_min_stock integer,
  p_is_trackable_lot boolean,
  p_images text[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_options text[]; v_attributes jsonb; v_id uuid;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được thêm biến thể'; end if;
  select options into v_options from public.products where id = p_product_id for update;
  if not found then raise exception 'Không tìm thấy vật tư'; end if;
  v_attributes := public._validate_variant_attributes(v_options, p_attributes);
  insert into public.variants(product_id, attributes, price, unit, min_stock, is_trackable_lot, images)
  values (p_product_id, v_attributes, p_price, nullif(btrim(p_unit), ''), greatest(p_min_stock, 0), p_is_trackable_lot, coalesce(p_images, array[]::text[]))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Tổ hợp biến thể đã tồn tại' using errcode = '23505';
end;
$$;

create or replace function public.update_variant_with_contract(
  p_variant_id uuid,
  p_attributes jsonb,
  p_price numeric,
  p_unit text,
  p_min_stock integer,
  p_is_trackable_lot boolean,
  p_images text[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_product_id uuid; v_options text[]; v_attributes jsonb;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được sửa biến thể'; end if;
  select product_id into v_product_id from public.variants where id = p_variant_id;
  if not found then raise exception 'Không tìm thấy biến thể'; end if;
  select options into v_options from public.products where id = v_product_id for update;
  v_attributes := public._validate_variant_attributes(v_options, p_attributes);
  update public.variants set attributes = v_attributes, price = p_price, unit = nullif(btrim(p_unit), ''), min_stock = greatest(p_min_stock, 0), is_trackable_lot = p_is_trackable_lot, images = coalesce(p_images, array[]::text[]), updated_at = now()
  where id = p_variant_id;
exception when unique_violation then
  raise exception 'Tổ hợp biến thể đã tồn tại' using errcode = '23505';
end;
$$;

revoke all on function public.update_product_options(uuid, text[], text[], text[]) from public;
revoke all on function public.create_variant_with_contract(uuid, jsonb, numeric, text, integer, boolean, text[]) from public;
revoke all on function public.update_variant_with_contract(uuid, jsonb, numeric, text, integer, boolean, text[]) from public;
grant execute on function public.update_product_options(uuid, text[], text[], text[]) to authenticated;
grant execute on function public.create_variant_with_contract(uuid, jsonb, numeric, text, integer, boolean, text[]) to authenticated;
grant execute on function public.update_variant_with_contract(uuid, jsonb, numeric, text, integer, boolean, text[]) to authenticated;
