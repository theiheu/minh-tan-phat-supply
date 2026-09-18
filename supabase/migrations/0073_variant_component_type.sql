-- 0073_variant_component_type.sql
-- Explicit discriminator for assemblies vs unit conversions, cross-product support, and atomic BOM RPC.

alter table public.variant_components
  add column if not exists component_type text;

update public.variant_components
set component_type = 'assembly'
where component_type is null;

alter table public.variant_components
  alter column component_type set not null;

alter table public.variant_components
  drop constraint if exists check_variant_component_type,
  drop constraint if exists check_variant_component_quantity,
  drop constraint if exists check_variant_component_no_self;

alter table public.variant_components
  add constraint check_variant_component_type check (component_type in ('assembly', 'unit_conversion')),
  add constraint check_variant_component_quantity check (quantity >= 1),
  add constraint check_variant_component_no_self check (parent_variant_id <> child_variant_id);

-- Enforce parent homogeneity and unit_conversion same-product invariant
create or replace function public._check_variant_components_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_product_id uuid;
  v_child_product_id uuid;
  v_existing_type text;
begin
  select product_id into v_parent_product_id from public.variants where id = NEW.parent_variant_id;
  select product_id into v_child_product_id from public.variants where id = NEW.child_variant_id;
  if v_parent_product_id is null or v_child_product_id is null then
    raise exception 'Biến thể cha hoặc con không tồn tại';
  end if;

  -- Ensure all components of the parent share the same component_type
  select component_type into v_existing_type
  from public.variant_components
  where parent_variant_id = NEW.parent_variant_id
    and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;
  if v_existing_type is not null and v_existing_type <> NEW.component_type then
    raise exception 'Không thể trộn lẫn Bộ lắp ráp và Quy đổi đơn vị trong cùng một vật tư';
  end if;

  -- unit_conversion must be within the same product
  if NEW.component_type = 'unit_conversion' and v_parent_product_id <> v_child_product_id then
    raise exception 'Quy đổi đơn vị bắt buộc phải cùng một vật tư cha';
  end if;

  -- child cannot itself be a parent
  if exists (select 1 from public.variant_components where parent_variant_id = NEW.child_variant_id) then
    raise exception 'Linh kiện con không được là một bộ lắp ráp hoặc đơn vị quy đổi khác';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_variant_components_integrity on public.variant_components;
create trigger trg_check_variant_components_integrity
  before insert or update on public.variant_components
  for each row execute function public._check_variant_components_integrity();

-- Atomic RPC for saving variant components
create or replace function public.save_variant_components(
  p_parent_variant_id uuid,
  p_type text,
  p_components jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_child_id uuid;
  v_qty integer;
begin
  if not public.is_manager() then
    raise exception 'Chỉ quản lý kho được cấu hình bộ lắp ráp / quy đổi đơn vị';
  end if;
  if p_type not in ('assembly', 'unit_conversion') then
    raise exception 'Loại cấu phần không hợp lệ: %', p_type;
  end if;
  if not exists (select 1 from public.variants where id = p_parent_variant_id) then
    raise exception 'Không tìm thấy biến thể cha';
  end if;

  -- Lock parent
  perform 1 from public.variants where id = p_parent_variant_id for update;

  delete from public.variant_components where parent_variant_id = p_parent_variant_id;

  if p_components is not null and jsonb_array_length(p_components) > 0 then
    for v_item in select * from jsonb_array_elements(p_components) loop
      v_child_id := (v_item ->> 'child_variant_id')::uuid;
      v_qty := coalesce((v_item ->> 'quantity')::integer, 1);
      if v_qty < 1 then raise exception 'Số lượng linh kiện phải >= 1'; end if;
      insert into public.variant_components (parent_variant_id, child_variant_id, quantity, component_type)
      values (p_parent_variant_id, v_child_id, v_qty, p_type);
    end loop;
  end if;
end;
$$;

revoke all on function public.save_variant_components(uuid, text, jsonb) from public;
grant execute on function public.save_variant_components(uuid, text, jsonb) to authenticated;
