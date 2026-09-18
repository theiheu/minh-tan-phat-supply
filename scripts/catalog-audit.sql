\set ON_ERROR_STOP on
\pset pager off
begin transaction read only;

\echo '=== catalog audit summary (every *_issues value must be zero unless explicitly accepted) ==='
with
negative_balances as (select id from public.stock_balances where quantity < 0),
duplicate_defaults as (select product_id from public.variants where is_default group by product_id having count(*) > 1),
missing_base_units as (select id from public.variants where base_unit_id is null),
orphan_attr_values as (select id from public.sku_attribute_values sav where not exists (select 1 from public.variants v where v.id = sav.sku_id)),
invalid_bom_items as (
  select bi.id from public.bom_items bi
  join public.bom_versions bv on bv.id = bi.bom_version_id
  join public.bom_headers bh on bh.id = bv.bom_header_id
  where bh.sku_id = bi.component_sku_id or bi.base_quantity <= 0
),
orphan_refs as (
  select 'defect_note_items' source, d.id from public.defect_note_items d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'exchange_note_items', d.id from public.exchange_note_items d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'issue_items', d.id from public.issue_items d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'liquidation_items', d.id from public.liquidation_items d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'receipt_items', d.id from public.receipt_items d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'repair_order_items', d.id from public.repair_order_items d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'requisition_items', d.id from public.requisition_items d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'requisition_return_items', d.id from public.requisition_return_items d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'stock_balances', d.id from public.stock_balances d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'stock_movements', d.id from public.stock_movements d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'stocktake_items', d.id from public.stocktake_items d left join public.variants v on v.id=d.sku_id where v.id is null
  union all select 'tool_borrowing_items', d.id from public.tool_borrowing_items d left join public.variants v on v.id=d.sku_id where v.id is null
)
select * from (values
 ('skus_missing_base_unit', (select count(*) from missing_base_units)),
 ('orphan_sku_attribute_values', (select count(*) from orphan_attr_values)),
 ('invalid_bom_items', (select count(*) from invalid_bom_items)),
 ('negative_stock_balances', (select count(*) from negative_balances)),
 ('duplicate_default_skus', (select count(*) from duplicate_defaults)),
 ('orphan_variant_references', (select count(*) from orphan_refs))
) audit(metric, issue_count) order by metric;

\echo '=== identity and checksum baseline ==='
select
 (select count(*) from public.products) as product_count,
 (select count(*) from public.variants) as sku_count,
 (select md5(string_agg(id::text, ',' order by id::text)) from public.variants) as sku_uuid_checksum,
 (select count(*) from public.stock_balances) as balance_count,
 (select coalesce(sum(quantity::numeric),0) from public.stock_balances) as balance_total,
 (select count(*) from public.stock_movements) as movement_count;

\echo '=== optional identity comparison ==='
\if :{?expected_product_count}
  select case when (select count(*) from public.products) = :expected_product_count::bigint
              then 'PASS' else 'FAIL' end as product_count_check;
  select case when (select count(*) from public.variants) = :expected_sku_count::bigint
              then 'PASS' else 'FAIL' end as sku_count_check;
  select case when (select md5(string_agg(id::text, ',' order by id::text)) from public.variants) = :'expected_sku_uuid_checksum'
              then 'PASS' else 'FAIL' end as sku_uuid_checksum_check;
  select ((select count(*) from public.products) = :expected_product_count::bigint
          and (select count(*) from public.variants) = :expected_sku_count::bigint
          and (select md5(string_agg(id::text, ',' order by id::text)) from public.variants) = :'expected_sku_uuid_checksum') as identity_matches \gset
  \if :identity_matches
    \echo 'Identity comparison passed.'
  \else
    \echo 'Identity comparison failed.'
    select 1 / 0 as force_nonzero_exit;
  \endif
\else
  \echo 'No expected_* variables supplied; emitted baseline only.'
\endif

commit;
