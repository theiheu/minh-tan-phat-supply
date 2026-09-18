\set ON_ERROR_STOP on
\pset pager off
begin transaction read only;
\echo '=== catalog profile: metadata ==='
select current_database() as database_name, current_setting('server_version') as postgres_version, now() as profiled_at;

\echo '=== core row counts ==='
select * from (values
  ('products', (select count(*) from public.products)),
  ('variants_current_skus', (select count(*) from public.variants)),
  ('variant_components', (select count(*) from public.variant_components)),
  ('stock_balances', (select count(*) from public.stock_balances)),
  ('positive_stock_balances', (select count(*) from public.stock_balances where quantity > 0)),
  ('stock_movements', (select count(*) from public.stock_movements)),
  ('receipt_items', (select count(*) from public.receipt_items)),
  ('receipt_items_with_batch', (select count(*) from public.receipt_items where nullif(btrim(batch_no), '') is not null)),
  ('receipt_items_with_expiry', (select count(*) from public.receipt_items where expiry_date is not null))
) as counts(metric, value) order by metric;

\echo '=== product/SKU shape ==='
select
  count(*) filter (where cardinality(p.options) = 0) as products_without_options,
  count(*) filter (where cardinality(p.options) > 0) as products_with_options,
  count(*) filter (where cardinality(p.options) > 3) as products_over_three_options,
  count(*) filter (where coalesce(v.sku_count, 0) = 0) as products_without_skus,
  count(*) filter (where coalesce(v.sku_count, 0) = 1) as single_sku_products,
  count(*) filter (where coalesce(v.sku_count, 0) > 1) as multi_sku_products,
  max(coalesce(v.sku_count, 0)) as max_skus_per_product
from public.products p
left join (select product_id, count(*) sku_count from public.variants group by product_id) v on v.product_id = p.id;

\echo '=== unit strings requiring canonical mapping ==='
select coalesce(nullif(btrim(unit), ''), '<NULL_OR_BLANK>') as legacy_unit, count(*) as sku_count
from public.variants group by 1 order by sku_count desc, legacy_unit;

\echo '=== option names requiring canonical attribute mapping ==='
select btrim(option_name) as legacy_option_name, count(distinct p.id) as product_count
from public.products p cross join lateral unnest(p.options) option_name
group by 1 order by product_count desc, legacy_option_name;

\echo '=== attribute keys and sample values ==='
select entry.key as legacy_attribute_key, count(*) as sku_count,
       count(distinct entry.value) as distinct_values,
       md5(string_agg(distinct entry.value, '|' order by entry.value)) as value_set_checksum
from public.variants v cross join lateral jsonb_each_text(v.attributes) entry
group by entry.key order by sku_count desc, entry.key;

\echo '=== components ==='
select component_type, count(*) as rows, count(distinct parent_sku_id) as parents,
       count(distinct child_sku_id) as children,
       min(quantity) as min_quantity, max(quantity) as max_quantity
from public.variant_components group by component_type order by component_type;

\echo '=== balance and movement quantity ranges ==='
select 'stock_balances' source, min(quantity::numeric) min_qty, max(quantity::numeric) max_qty,
       count(*) filter (where quantity < 0) negative_rows,
       count(*) filter (where quantity <> trunc(quantity::numeric)) fractional_rows
from public.stock_balances
union all
select 'stock_movements', min(quantity::numeric), max(quantity::numeric),
       count(*) filter (where quantity < 0), count(*) filter (where quantity <> trunc(quantity::numeric))
from public.stock_movements;

\echo '=== movement types ==='
select movement_type::text, count(*) rows, sum(quantity::numeric) total_quantity
from public.stock_movements group by movement_type order by movement_type;

\echo '=== variant/SKU foreign keys ==='
select conrelid::regclass::text as referencing_table, conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f' and pg_get_constraintdef(oid) ilike '%variants%'
order by referencing_table, conname;

\echo '=== dependent views ==='
select schemaname, viewname from pg_views
where schemaname = 'public' and definition ilike '%variant%'
order by viewname;

\echo '=== dependent functions ==='
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind in ('f','p')
  and (p.proname ilike '%variant%' or pg_get_functiondef(p.oid) ilike '%variant%')
order by p.proname, args;

\echo '=== dependent triggers ==='
select event_object_table, trigger_name, action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and (event_object_table ilike '%variant%' or action_statement ilike '%variant%')
order by event_object_table, trigger_name;

\echo '=== dependent policies ==='
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public'
  and (tablename ilike '%variant%' or coalesce(qual,'') ilike '%variant%' or coalesce(with_check,'') ilike '%variant%')
order by tablename, policyname;

\echo '=== catalog/inventory column contract ==='
select table_name, column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema='public' and (column_name ilike '%variant%' or table_name in ('products','variants','variant_components','stock_balances','stock_movements'))
order by table_name, ordinal_position;

\echo '=== constraints ==='
select conrelid::regclass::text table_name, conname, contype, pg_get_constraintdef(oid) definition
from pg_constraint where connamespace='public'::regnamespace
  and (conrelid::regclass::text ilike '%variant%' or pg_get_constraintdef(oid) ilike '%variant%')
order by table_name, conname;

\echo '=== indexes ==='
select tablename, indexname, indexdef from pg_indexes where schemaname='public'
  and (tablename ilike '%variant%' or indexdef ilike '%variant%') order by tablename,indexname;

\echo '=== grants ==='
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('products','variants','variant_components','stock_balances','stock_movements')
order by table_name,grantee,privilege_type;

\echo '=== materialized views ==='
select schemaname, matviewname from pg_matviews where schemaname='public'
  and definition ilike '%variant%' order by matviewname;

\echo '=== publications and subscriptions ==='
select pubname, schemaname, tablename from pg_publication_tables
where schemaname='public' and tablename in ('products','variants','variant_components','stock_balances','stock_movements')
order by pubname,tablename;
select subname, subenabled from pg_subscription order by subname;

\echo '=== functions that write balance or movement tables ==='
select p.proname, pg_get_function_identity_arguments(p.oid) args,
       (pg_get_functiondef(p.oid) ~* '(insert into|update|delete from) public\.stock_balances') writes_balances,
       (pg_get_functiondef(p.oid) ~* '(insert into|update|delete from) public\.stock_movements') writes_movements
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind in ('f','p')
  and pg_get_functiondef(p.oid) ~* '(stock_balances|stock_movements)'
order by p.proname,args;

rollback;
