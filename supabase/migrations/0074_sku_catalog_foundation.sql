-- 0074_sku_catalog_foundation.sql
-- Additive normalized Product/SKU/UOM/BOM foundation. The old runtime remains authoritative until cutover.

create extension if not exists btree_gist;

create table public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(code) and code ~ '^[a-z0-9_]+$'),
  name text not null,
  symbol text not null,
  dimension text not null check (dimension in ('count','mass','volume','length','area','power','voltage','current','time','package')),
  factor_to_reference numeric(20,9) not null default 1 check (factor_to_reference > 0),
  decimal_scale smallint not null default 0 check (decimal_scale between 0 and 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(code) and code ~ '^[a-z0-9_]+$'),
  name text not null,
  data_type text not null check (data_type in ('option','number','measurement','text','boolean')),
  measurement_dimension text,
  default_unit_id uuid references public.units(id),
  allow_custom_value boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((data_type = 'measurement') = (measurement_dimension is not null))
);

create table public.attribute_option_values (
  id uuid primary key default gen_random_uuid(),
  attribute_definition_id uuid not null references public.attribute_definitions(id) on delete cascade,
  code text not null,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (attribute_definition_id, code),
  unique (id, attribute_definition_id)
);

create table public.product_attribute_definitions (
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_definition_id uuid not null references public.attribute_definitions(id),
  is_required boolean not null default true,
  is_variant_axis boolean not null default true,
  display_order smallint not null check (display_order >= 0),
  created_at timestamptz not null default now(),
  primary key (product_id, attribute_definition_id),
  unique (product_id, display_order)
);

create table public.sku_attribute_values (
  sku_id uuid not null references public.variants(id) on delete cascade,
  attribute_definition_id uuid not null references public.attribute_definitions(id),
  option_value_id uuid references public.attribute_option_values(id),
  text_value text,
  numeric_value numeric(20,6),
  boolean_value boolean,
  unit_id uuid references public.units(id),
  legacy_text_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sku_id, attribute_definition_id),
  foreign key (option_value_id, attribute_definition_id)
    references public.attribute_option_values(id, attribute_definition_id),
  check (num_nonnulls(option_value_id, text_value, numeric_value, boolean_value) = 1),
  check ((numeric_value is null and unit_id is null) or numeric_value is not null)
);

create table public.sku_transaction_units (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.variants(id) on delete cascade,
  unit_id uuid not null references public.units(id),
  code text not null,
  display_name text not null,
  factor_to_base numeric(20,9) not null check (factor_to_base > 0),
  allow_receipt boolean not null default true,
  allow_issue boolean not null default true,
  allow_fraction boolean not null default false,
  is_base boolean not null default false,
  is_active boolean not null default true,
  legacy_parent_variant_id uuid references public.variants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sku_id, code)
);
create unique index sku_transaction_units_one_base on public.sku_transaction_units(sku_id) where is_base;

create table public.barcode_registry (
  id uuid primary key default gen_random_uuid(),
  barcode text not null unique check (btrim(barcode) <> ''),
  sku_id uuid references public.variants(id) on delete cascade,
  transaction_unit_id uuid references public.sku_transaction_units(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (num_nonnulls(sku_id, transaction_unit_id) = 1)
);

create table public.bom_headers (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null unique references public.variants(id) on delete cascade,
  inventory_policy text not null check (inventory_policy in ('virtual_kit','stocked_assembly')),
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bom_versions (
  id uuid primary key default gen_random_uuid(),
  bom_header_id uuid not null references public.bom_headers(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null check (status in ('draft','scheduled','active','retired')),
  effective_period tstzrange not null,
  change_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (bom_header_id, version_number),
  exclude using gist (bom_header_id with =, effective_period with &&) where (status in ('scheduled','active'))
);

alter table public.bom_headers
  add constraint bom_headers_active_version_fkey foreign key (active_version_id) references public.bom_versions(id);

create table public.bom_items (
  id uuid primary key default gen_random_uuid(),
  bom_version_id uuid not null references public.bom_versions(id) on delete cascade,
  component_sku_id uuid not null references public.variants(id),
  base_quantity numeric(20,6) not null check (base_quantity > 0),
  wastage_percent numeric(7,4) not null default 0 check (wastage_percent between 0 and 100),
  legacy_component_id uuid unique references public.variant_components(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bom_version_id, component_sku_id)
);

create table public.catalog_drafts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  owner_id uuid not null references public.profiles(id),
  status text not null default 'draft' check (status in ('draft','activated','abandoned')),
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sku_prices (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.variants(id) on delete cascade,
  transaction_unit_id uuid references public.sku_transaction_units(id),
  price_type text not null check (price_type in ('purchase','sale','reference')),
  price_basis text not null check (price_basis in ('base_uom','transaction_uom')),
  amount numeric(18,2) not null check (amount >= 0),
  base_unit_amount numeric(20,6),
  currency text not null default 'VND',
  effective_period tstzrange not null default tstzrange(now(), null, '[)'),
  source text,
  created_at timestamptz not null default now(),
  check ((price_basis = 'transaction_uom') = (transaction_unit_id is not null))
);

create table public.catalog_migration_issues (
  id uuid primary key default gen_random_uuid(),
  issue_type text not null,
  source_table text not null,
  source_id uuid,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','resolved','accepted_legacy_gap')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.products
  add column if not exists catalog_status text not null default 'active',
  add column if not exists search_keywords text[] not null default '{}',
  add column if not exists internal_notes text,
  add constraint products_catalog_status_check check (catalog_status in ('draft','active','archived'));

alter table public.variants
  add column if not exists sku_code text,
  add column if not exists sku_status text not null default 'active',
  add column if not exists base_unit_id uuid references public.units(id),
  add column if not exists tracking_policy text not null default 'none',
  add column if not exists inventory_policy text not null default 'normal',
  add column if not exists allow_fraction boolean not null default false,
  add constraint variants_sku_status_check check (sku_status in ('draft','active','inactive')),
  add constraint variants_tracking_policy_check check (tracking_policy in ('none','lot','lot_expiry','serial')),
  add constraint variants_inventory_policy_check check (inventory_policy in ('normal','virtual_kit','stocked_assembly'));

create unique index variants_sku_code_unique on public.variants(lower(sku_code)) where sku_code is not null;
create index sku_attribute_values_attribute on public.sku_attribute_values(attribute_definition_id);
create index sku_transaction_units_sku on public.sku_transaction_units(sku_id);
create index bom_items_component on public.bom_items(component_sku_id);
create index catalog_drafts_owner_status on public.catalog_drafts(owner_id,status,updated_at desc);
create index sku_prices_sku_type on public.sku_prices(sku_id,price_type);
create unique index catalog_migration_issues_source_unique
  on public.catalog_migration_issues(issue_type,source_table,source_id) where source_id is not null;
create index catalog_migration_issues_status on public.catalog_migration_issues(status,issue_type);


-- Cross-table invariants that plain CHECK constraints cannot express.
create or replace function public.validate_sku_attribute_value()
returns trigger language plpgsql set search_path=public as $$
declare v_type text; v_product uuid; v_dimension text; v_unit_dimension text;
begin
  select a.data_type,a.measurement_dimension into v_type,v_dimension
  from public.attribute_definitions a where a.id=new.attribute_definition_id;
  select product_id into v_product from public.variants where id=new.sku_id;
  if not exists(select 1 from public.product_attribute_definitions p where p.product_id=v_product and p.attribute_definition_id=new.attribute_definition_id) then
    raise exception 'Thuộc tính không thuộc hợp đồng Product';
  end if;
  if (v_type='option' and new.option_value_id is null)
    or (v_type='text' and new.text_value is null)
    or (v_type='number' and (new.numeric_value is null or new.unit_id is not null))
    or (v_type='measurement' and (new.numeric_value is null or new.unit_id is null))
    or (v_type='boolean' and new.boolean_value is null) then
    raise exception 'Giá trị không khớp kiểu thuộc tính %',v_type;
  end if;
  if v_type='measurement' then
    select dimension into v_unit_dimension from public.units where id=new.unit_id;
    if v_unit_dimension is distinct from v_dimension then raise exception 'Đơn vị không khớp đại lượng thuộc tính'; end if;
  end if;
  return new;
end $$;
create trigger trg_validate_sku_attribute_value before insert or update on public.sku_attribute_values
for each row execute function public.validate_sku_attribute_value();

create or replace function public.validate_sku_transaction_unit()
returns trigger language plpgsql set search_path=public as $$
declare v_base uuid; v_scale smallint; v_tracking text;
begin
  select base_unit_id,tracking_policy into v_base,v_tracking from public.variants where id=new.sku_id;
  select decimal_scale into v_scale from public.units where id=new.unit_id;
  if new.is_base and (new.factor_to_base<>1 or new.unit_id<>v_base) then raise exception 'Đơn vị cơ sở phải có factor 1 và trùng base_unit_id'; end if;
  if v_tracking='serial' and (new.allow_fraction or v_scale<>0) then raise exception 'SKU serial không cho phép số lẻ'; end if;
  return new;
end $$;
create trigger trg_validate_sku_transaction_unit before insert or update on public.sku_transaction_units
for each row execute function public.validate_sku_transaction_unit();

create or replace function public.validate_bom_header_active_version()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.active_version_id is not null and not exists(
    select 1 from public.bom_versions v where v.id=new.active_version_id and v.bom_header_id=new.id and v.status='active'
  ) then raise exception 'Phiên bản BOM active không thuộc header hoặc chưa active'; end if;
  return new;
end $$;
create constraint trigger trg_validate_bom_header_active_version
  after insert or update of active_version_id on public.bom_headers deferrable initially deferred
  for each row execute function public.validate_bom_header_active_version();

create or replace function public.validate_bom_item_one_level()
returns trigger language plpgsql set search_path=public as $$
declare v_parent uuid;
begin
  select h.sku_id into v_parent from public.bom_versions v join public.bom_headers h on h.id=v.bom_header_id where v.id=new.bom_version_id;
  if v_parent=new.component_sku_id then raise exception 'BOM không được tự tham chiếu'; end if;
  if exists(select 1 from public.bom_headers h join public.bom_versions v on v.bom_header_id=h.id where h.sku_id=new.component_sku_id and v.status in ('scheduled','active')) then
    raise exception 'BOM lồng nhau không được hỗ trợ';
  end if;
  return new;
end $$;
create trigger trg_validate_bom_item_one_level before insert or update on public.bom_items
for each row execute function public.validate_bom_item_one_level();


create or replace function public.guard_bom_version_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and old.status <> 'draft' then
    raise exception 'BOM version đã kích hoạt/retire là bất biến';
  end if;
  if new.status in ('scheduled','active') then
    if auth.uid() is not null and not public.is_warehouse() then raise exception 'Chỉ quản kho/chủ trại/superuser được kích hoạt BOM'; end if;
    if exists(
      select 1 from public.bom_items parent_item
      join public.bom_versions parent_version on parent_version.id=parent_item.bom_version_id
      where parent_item.component_sku_id=(select sku_id from public.bom_headers where id=new.bom_header_id)
        and parent_version.status in ('scheduled','active')
    ) then raise exception 'SKU đang là linh kiện của BOM active nên không thể kích hoạt BOM riêng'; end if;
    if exists(
      select 1 from public.bom_items item
      join public.bom_headers child_header on child_header.sku_id=item.component_sku_id
      join public.bom_versions child_version on child_version.bom_header_id=child_header.id
      where item.bom_version_id=new.id and child_version.status in ('scheduled','active')
    ) then raise exception 'Linh kiện không được có BOM active'; end if;
  end if;
  return new;
end $$;
create trigger trg_guard_bom_version_mutation before insert or update on public.bom_versions
for each row execute function public.guard_bom_version_mutation();


create or replace function public.sync_bom_header_active_version()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='active' then
    update public.bom_headers set active_version_id=new.id,updated_at=now() where id=new.bom_header_id;
  end if;
  if new.status='retired'
     and (select active_version_id from public.bom_headers where id=new.bom_header_id)=new.id then
    update public.bom_headers set active_version_id=null,updated_at=now() where id=new.bom_header_id;
  end if;
  return new;
end $$;
create trigger trg_sync_bom_header_active_version
after insert or update of status on public.bom_versions
for each row execute function public.sync_bom_header_active_version();

create or replace function public.guard_bom_header_activation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.active_version_id is distinct from old.active_version_id
     and auth.uid() is not null and not public.is_warehouse() then
    raise exception 'Chỉ quản kho/chủ trại/superuser được đặt BOM active';
  end if;
  return new;
end $$;
create trigger trg_guard_bom_header_activation before update of active_version_id on public.bom_headers
for each row execute function public.guard_bom_header_activation();

-- Additive RLS: old runtime policies remain unchanged; new owners follow current catalog authorization.
alter table public.units enable row level security;
alter table public.attribute_definitions enable row level security;
alter table public.attribute_option_values enable row level security;
alter table public.product_attribute_definitions enable row level security;
alter table public.sku_attribute_values enable row level security;
alter table public.sku_transaction_units enable row level security;
alter table public.barcode_registry enable row level security;
alter table public.bom_headers enable row level security;
alter table public.bom_versions enable row level security;
alter table public.bom_items enable row level security;
alter table public.catalog_drafts enable row level security;
alter table public.sku_prices enable row level security;
alter table public.catalog_migration_issues enable row level security;

create policy units_select on public.units for select to authenticated using (true);
create policy units_write on public.units for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy attribute_definitions_select on public.attribute_definitions for select to authenticated using (true);
create policy attribute_definitions_write on public.attribute_definitions for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy attribute_option_values_select on public.attribute_option_values for select to authenticated using (true);
create policy attribute_option_values_write on public.attribute_option_values for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy product_attribute_definitions_select on public.product_attribute_definitions for select to authenticated using (true);
create policy product_attribute_definitions_write on public.product_attribute_definitions for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy sku_attribute_values_select on public.sku_attribute_values for select to authenticated using (true);
create policy sku_attribute_values_write on public.sku_attribute_values for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy sku_transaction_units_select on public.sku_transaction_units for select to authenticated using (true);
create policy sku_transaction_units_write on public.sku_transaction_units for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy barcode_registry_select on public.barcode_registry for select to authenticated using (true);
create policy barcode_registry_write on public.barcode_registry for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy bom_headers_select on public.bom_headers for select to authenticated using (true);
create policy bom_headers_insert on public.bom_headers for insert to authenticated with check (public.is_technician());
create policy bom_headers_update on public.bom_headers for update to authenticated using (public.is_technician()) with check (public.is_technician());
create policy bom_headers_delete on public.bom_headers for delete to authenticated using (public.is_warehouse() and active_version_id is null);
create policy bom_versions_select on public.bom_versions for select to authenticated using (true);
create policy bom_versions_insert on public.bom_versions for insert to authenticated with check (public.is_technician() and status = 'draft');
create policy bom_versions_update_draft on public.bom_versions for update to authenticated
  using ((public.is_technician() and status = 'draft') or public.is_warehouse())
  with check ((public.is_technician() and status = 'draft') or public.is_warehouse());
create policy bom_versions_delete_draft on public.bom_versions for delete to authenticated using (public.is_warehouse() and status = 'draft');
create policy bom_items_select on public.bom_items for select to authenticated using (true);
create policy bom_items_insert_draft on public.bom_items for insert to authenticated with check (public.is_technician() and exists (select 1 from public.bom_versions v where v.id=bom_version_id and v.status='draft'));
create policy bom_items_update_draft on public.bom_items for update to authenticated using (public.is_technician() and exists (select 1 from public.bom_versions v where v.id=bom_version_id and v.status='draft')) with check (public.is_technician() and exists (select 1 from public.bom_versions v where v.id=bom_version_id and v.status='draft'));
create policy bom_items_delete_draft on public.bom_items for delete to authenticated using (public.is_technician() and exists (select 1 from public.bom_versions v where v.id=bom_version_id and v.status='draft'));
create policy catalog_drafts_manager on public.catalog_drafts for all to authenticated using (public.is_manager()) with check (public.is_manager() and owner_id=auth.uid());
create policy sku_prices_select on public.sku_prices for select to authenticated using (public.is_accountant());
create policy sku_prices_write on public.sku_prices for all to authenticated using (public.is_accountant()) with check (public.is_accountant());
create policy catalog_migration_issues_select on public.catalog_migration_issues for select to authenticated using (public.is_owner());


create or replace function public.audit_normalized_catalog_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_before jsonb; v_after jsonb;
begin
  v_before := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_after := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  v_id := coalesce((v_after->>'id')::uuid,(v_before->>'id')::uuid,(v_after->>'sku_id')::uuid,(v_before->>'sku_id')::uuid,(v_after->>'product_id')::uuid,(v_before->>'product_id')::uuid);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before,after)
  values(auth.uid(),'catalog.'||lower(tg_op),tg_table_name,v_id,v_before,v_after);
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger trg_audit_attribute_definitions after insert or update or delete on public.attribute_definitions for each row execute function public.audit_normalized_catalog_change();
create trigger trg_audit_product_attribute_definitions after insert or update or delete on public.product_attribute_definitions for each row execute function public.audit_normalized_catalog_change();
create trigger trg_audit_sku_attribute_values after insert or update or delete on public.sku_attribute_values for each row execute function public.audit_normalized_catalog_change();
create trigger trg_audit_sku_transaction_units after insert or update or delete on public.sku_transaction_units for each row execute function public.audit_normalized_catalog_change();
create trigger trg_audit_bom_headers after insert or update or delete on public.bom_headers for each row execute function public.audit_normalized_catalog_change();
create trigger trg_audit_bom_versions after insert or update or delete on public.bom_versions for each row execute function public.audit_normalized_catalog_change();
create trigger trg_audit_bom_items after insert or update or delete on public.bom_items for each row execute function public.audit_normalized_catalog_change();

-- Reuse the existing updated-at owner for mutable catalog records.
create trigger trg_units_updated before update on public.units for each row execute function public.set_updated_at();
create trigger trg_attribute_definitions_updated before update on public.attribute_definitions for each row execute function public.set_updated_at();
create trigger trg_sku_attribute_values_updated before update on public.sku_attribute_values for each row execute function public.set_updated_at();
create trigger trg_sku_transaction_units_updated before update on public.sku_transaction_units for each row execute function public.set_updated_at();
create trigger trg_bom_headers_updated before update on public.bom_headers for each row execute function public.set_updated_at();
create trigger trg_catalog_drafts_updated before update on public.catalog_drafts for each row execute function public.set_updated_at();
