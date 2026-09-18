-- 0075_sku_catalog_backfill.sql
-- Deterministic in-place backfill for the normalized catalog foundation.
-- Does not rename/drop old owners and does not switch runtime reads or writes.

-- Canonical legacy units. Codes remain stable; duplicate spelling/case maps to one row.
insert into public.units(code,name,symbol,dimension,factor_to_reference,decimal_scale)
values
 ('cai','Cái','cái','count',1,0),('soi','Sợi','sợi','count',1,0),
 ('met','Mét','m','length',1,3),('cay','Cây','cây','package',1,0),
 ('bo','Bộ','bộ','count',1,0),('con','Con','con','count',1,0),
 ('cuon','Cuộn','cuộn','package',1,0),('hop','Hộp','hộp','package',1,0),
 ('bich','Bịch','bịch','package',1,0),('kg','Kilôgam','kg','mass',1,3),
 ('can','Can','can','package',1,0),('chai','Chai','chai','package',1,0),
 ('lit','Lít','l','volume',1,3),('vien','Viên','viên','count',1,0),
 ('cap','Cặp','cặp','count',1,0),('thung','Thùng','thùng','package',1,0),
 ('canh','Cánh','cánh','count',1,0),('doi','Đôi','đôi','count',1,0),
 ('tam','Tấm','tấm','count',1,0),('binh','Bình','bình','package',1,0),
 ('bo_goi','Bó','bó','package',1,0),('chiec','Chiếc','chiếc','count',1,0),
 ('to','Tờ','tờ','count',1,0),('trai','Trái','trái','count',1,0),
 ('tuyp','Tuýp','tuýp','package',1,0)
on conflict (code) do update set name=excluded.name,symbol=excluded.symbol,
 dimension=excluded.dimension,factor_to_reference=excluded.factor_to_reference,
 decimal_scale=excluded.decimal_scale,is_active=true;

-- Record unknown legacy units instead of guessing.
insert into public.catalog_migration_issues(issue_type,source_table,source_id,details)
select 'unmapped_legacy_unit','variants',v.id,jsonb_build_object('legacy_unit',v.unit)
from public.variants v
where nullif(btrim(v.unit),'') is null
   or not exists (
     select 1 from public.units u where u.code = case lower(btrim(v.unit))
       when 'cái' then 'cai' when 'sợi' then 'soi' when 'mét' then 'met'
       when 'cây' then 'cay' when 'bộ' then 'bo' when 'con' then 'con'
       when 'cuộn' then 'cuon' when 'hộp' then 'hop' when 'bịch' then 'bich'
       when 'kg' then 'kg' when 'can' then 'can' when 'chai' then 'chai'
       when 'lít' then 'lit' when 'viên' then 'vien' when 'cặp' then 'cap'
       when 'thùng' then 'thung' when 'cánh' then 'canh' when 'đôi' then 'doi'
       when 'tấm' then 'tam' when 'bình' then 'binh' when 'bó' then 'bo_goi'
       when 'chiếc' then 'chiec' when 'tờ' then 'to' when 'trái' then 'trai'
       when 'tuýp' then 'tuyp' else null end
   )
on conflict do nothing;

-- Populate new SKU columns in the existing identity rows. No second SKU row is inserted.
update public.variants v
set sku_code = coalesce(v.sku_code,'SKU-'||replace(v.id::text,'-','')),
    base_unit_id = u.id,
    sku_status = 'active',
    tracking_policy = case when v.is_trackable_lot then 'lot_expiry' else 'none' end,
    inventory_policy = case when exists (
      select 1 from public.variant_components vc
      where vc.parent_variant_id=v.id and vc.component_type='assembly'
    ) and not exists (select 1 from public.stock_balances sb where sb.variant_id=v.id and sb.quantity<>0)
      and not exists (select 1 from public.stock_movements sm where sm.variant_id=v.id)
      then 'virtual_kit' else 'normal' end,
    allow_fraction = u.decimal_scale > 0
from public.units u
where u.code = case lower(btrim(v.unit))
  when 'cái' then 'cai' when 'sợi' then 'soi' when 'mét' then 'met'
  when 'cây' then 'cay' when 'bộ' then 'bo' when 'con' then 'con'
  when 'cuộn' then 'cuon' when 'hộp' then 'hop' when 'bịch' then 'bich'
  when 'kg' then 'kg' when 'can' then 'can' when 'chai' then 'chai'
  when 'lít' then 'lit' when 'viên' then 'vien' when 'cặp' then 'cap'
  when 'thùng' then 'thung' when 'cánh' then 'canh' when 'đôi' then 'doi'
  when 'tấm' then 'tam' when 'bình' then 'binh' when 'bó' then 'bo_goi'
  when 'chiếc' then 'chiec' when 'tờ' then 'to' when 'trái' then 'trai'
  when 'tuýp' then 'tuyp' else null end;

-- Every case-insensitive legacy option key becomes one stable typed definition.
-- Only semantics proven by the key are promoted; compound/free-form keys remain typed text.
insert into public.attribute_definitions(code,name,data_type,allow_custom_value)
select 'legacy_'||md5(lower(btrim(option_name))),min(btrim(option_name)),
  case lower(btrim(option_name))
    when 'hãng sản xuất' then 'option' when 'màu sắc' then 'option'
    when 'chủng loại' then 'option' else 'text' end,
  case when lower(btrim(option_name)) in ('hãng sản xuất','màu sắc','chủng loại') then false else true end
from public.products p cross join lateral unnest(p.options) option_name
where btrim(option_name)<>''
group by lower(btrim(option_name))
on conflict (code) do update set name=excluded.name,data_type=excluded.data_type,
 allow_custom_value=excluded.allow_custom_value,is_active=true;

-- Preserve Product option order and required axis semantics.
insert into public.product_attribute_definitions(product_id,attribute_definition_id,is_required,is_variant_axis,display_order)
select p.id,a.id,true,true,(o.ordinality-1)::smallint
from public.products p
cross join lateral unnest(p.options) with ordinality o(option_name,ordinality)
join public.attribute_definitions a on a.code='legacy_'||md5(lower(btrim(o.option_name)))
on conflict (product_id,attribute_definition_id) do update
set is_required=excluded.is_required,is_variant_axis=excluded.is_variant_axis,display_order=excluded.display_order;

-- Canonical option values for proven categorical attributes.
insert into public.attribute_option_values(attribute_definition_id,code,label)
select a.id,md5(lower(btrim(e.value))),min(btrim(e.value))
from public.variants v cross join lateral jsonb_each_text(v.attributes) e
join public.attribute_definitions a on a.code='legacy_'||md5(lower(btrim(e.key))) and a.data_type='option'
where btrim(e.value)<>'' group by a.id,lower(btrim(e.value))
on conflict (attribute_definition_id,code) do update set label=excluded.label,is_active=true;

-- Preserve every exact legacy attribute value in the column matching its proven type.
insert into public.sku_attribute_values(sku_id,attribute_definition_id,option_value_id,text_value,legacy_text_value)
select v.id,a.id,ov.id,case when a.data_type='text' then btrim(e.value) end,e.value
from public.variants v cross join lateral jsonb_each_text(v.attributes) e
join public.attribute_definitions a on a.code='legacy_'||md5(lower(btrim(e.key)))
left join public.attribute_option_values ov on ov.attribute_definition_id=a.id
  and ov.code=md5(lower(btrim(e.value))) and a.data_type='option'
where btrim(e.value)<>''
on conflict (sku_id,attribute_definition_id) do update
set option_value_id=excluded.option_value_id,text_value=excluded.text_value,
 legacy_text_value=excluded.legacy_text_value,updated_at=now();

-- Every SKU receives one base transaction UOM with factor 1.
insert into public.sku_transaction_units(sku_id,unit_id,code,display_name,factor_to_base,allow_receipt,allow_issue,allow_fraction,is_base)
select v.id,v.base_unit_id,'base',u.name,1,true,true,v.allow_fraction,true
from public.variants v join public.units u on u.id=v.base_unit_id
on conflict (sku_id,code) do update set unit_id=excluded.unit_id,display_name=excluded.display_name,
 factor_to_base=1,allow_fraction=excluded.allow_fraction,is_base=true,is_active=true,updated_at=now();

-- Preserve the current reference price with an explicit base-UOM basis.
insert into public.sku_prices(sku_id,price_type,price_basis,amount,base_unit_amount,source)
select v.id,'reference','base_uom',v.price,v.price,'legacy_variants.price'
from public.variants v where v.price is not null
and not exists (select 1 from public.sku_prices sp where sp.sku_id=v.id and sp.price_type='reference' and sp.source='legacy_variants.price');

-- Assembly parents are virtual only when they have no physical balance/movement evidence.
-- Any ambiguous parent is recorded and blocks the final gate instead of being guessed.
insert into public.catalog_migration_issues(issue_type,source_table,source_id,details)
select 'ambiguous_assembly_inventory_policy','variants',v.id,
 jsonb_build_object('positive_or_nonzero_balance_rows',(select count(*) from public.stock_balances sb where sb.variant_id=v.id and sb.quantity<>0),
                    'movement_rows',(select count(*) from public.stock_movements sm where sm.variant_id=v.id))
from public.variants v
where exists(select 1 from public.variant_components vc where vc.parent_variant_id=v.id and vc.component_type='assembly')
  and (exists(select 1 from public.stock_balances sb where sb.variant_id=v.id and sb.quantity<>0)
       or exists(select 1 from public.stock_movements sm where sm.variant_id=v.id))
on conflict do nothing;

insert into public.bom_headers(sku_id,inventory_policy)
select distinct vc.parent_variant_id,'virtual_kit'
from public.variant_components vc join public.variants v on v.id=vc.parent_variant_id
where vc.component_type='assembly' and v.inventory_policy='virtual_kit'
on conflict (sku_id) do update set inventory_policy=excluded.inventory_policy,updated_at=now();

insert into public.bom_versions(bom_header_id,version_number,status,effective_period,change_reason)
select bh.id,1,'active',tstzrange('-infinity','infinity','[)'),'Migrated from legacy assembly components'
from public.bom_headers bh
where not exists (select 1 from public.bom_versions bv where bv.bom_header_id=bh.id and bv.version_number=1);

insert into public.bom_items(bom_version_id,component_sku_id,base_quantity,wastage_percent,legacy_component_id)
select bv.id,vc.child_variant_id,vc.quantity::numeric,0,vc.id
from public.variant_components vc
join public.bom_headers bh on bh.sku_id=vc.parent_variant_id
join public.bom_versions bv on bv.bom_header_id=bh.id and bv.version_number=1
where vc.component_type='assembly'
on conflict (legacy_component_id) do update set component_sku_id=excluded.component_sku_id,
 base_quantity=excluded.base_quantity,wastage_percent=excluded.wastage_percent;

update public.bom_headers bh set active_version_id=bv.id,updated_at=now()
from public.bom_versions bv where bv.bom_header_id=bh.id and bv.status='active';

-- Proven legacy unit-conversion parents become transaction UOM aliases on their child/base SKU.
insert into public.sku_transaction_units(sku_id,unit_id,code,display_name,factor_to_base,
 allow_receipt,allow_issue,allow_fraction,is_base,legacy_parent_variant_id)
select vc.child_variant_id,p.base_unit_id,'legacy_pack_'||replace(vc.parent_variant_id::text,'-',''),
 coalesce(nullif(btrim(p.unit),''),'Đơn vị đóng gói'),vc.quantity::numeric,true,true,false,false,vc.parent_variant_id
from public.variant_components vc
join public.variants p on p.id=vc.parent_variant_id
where vc.component_type='unit_conversion'
on conflict (sku_id,code) do update set factor_to_base=excluded.factor_to_base,
 display_name=excluded.display_name,legacy_parent_variant_id=excluded.legacy_parent_variant_id,updated_at=now();


-- Temporary synchronization keeps additive normalized owners coherent while the old runtime remains active.
create or replace function public.prepare_legacy_variant_catalog()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_unit uuid; v_scale smallint; v_code text;
begin
  v_code := case lower(btrim(new.unit))
    when 'cái' then 'cai' when 'sợi' then 'soi' when 'mét' then 'met' when 'cây' then 'cay'
    when 'bộ' then 'bo' when 'con' then 'con' when 'cuộn' then 'cuon' when 'hộp' then 'hop'
    when 'bịch' then 'bich' when 'kg' then 'kg' when 'can' then 'can' when 'chai' then 'chai'
    when 'lít' then 'lit' when 'viên' then 'vien' when 'cặp' then 'cap' when 'thùng' then 'thung'
    when 'cánh' then 'canh' when 'đôi' then 'doi' when 'tấm' then 'tam' when 'bình' then 'binh'
    when 'bó' then 'bo_goi' when 'chiếc' then 'chiec' when 'tờ' then 'to' when 'trái' then 'trai'
    when 'tuýp' then 'tuyp' else null end;
  select id,decimal_scale into v_unit,v_scale from public.units where code=v_code;
  new.sku_code := coalesce(new.sku_code,'SKU-'||replace(new.id::text,'-',''));
  new.base_unit_id := v_unit;
  new.tracking_policy := case when new.is_trackable_lot then 'lot_expiry' else 'none' end;
  new.allow_fraction := coalesce(v_scale>0,false);
  return new;
end $$;
create trigger trg_prepare_legacy_variant_catalog before insert or update of unit,is_trackable_lot on public.variants
for each row execute function public.prepare_legacy_variant_catalog();

create or replace function public.sync_legacy_variant_children()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_scale smallint;
begin
  if new.base_unit_id is null then
    insert into public.catalog_migration_issues(issue_type,source_table,source_id,details)
    values('unmapped_legacy_unit','variants',new.id,jsonb_build_object('legacy_unit',new.unit))
    on conflict (issue_type,source_table,source_id) where source_id is not null
    do update set details=excluded.details,status='open',resolved_at=null;
    return new;
  end if;
  delete from public.catalog_migration_issues where issue_type='unmapped_legacy_unit' and source_table='variants' and source_id=new.id;
  select decimal_scale into v_scale from public.units where id=new.base_unit_id;
  insert into public.sku_transaction_units(sku_id,unit_id,code,display_name,factor_to_base,allow_fraction,is_base)
  select new.id,new.base_unit_id,'base',u.name,1,v_scale>0,true from public.units u where u.id=new.base_unit_id
  on conflict (sku_id,code) do update set unit_id=excluded.unit_id,display_name=excluded.display_name,
    factor_to_base=1,allow_fraction=excluded.allow_fraction,is_base=true,updated_at=now();
  insert into public.attribute_option_values(attribute_definition_id,code,label)
  select a.id,md5(lower(btrim(e.value))),btrim(e.value)
  from jsonb_each_text(new.attributes) e join public.attribute_definitions a
    on a.code='legacy_'||md5(lower(btrim(e.key))) and a.data_type='option'
  where btrim(e.value)<>''
  on conflict(attribute_definition_id,code) do update set label=excluded.label,is_active=true;
  delete from public.sku_attribute_values where sku_id=new.id;
  insert into public.sku_attribute_values(sku_id,attribute_definition_id,option_value_id,text_value,legacy_text_value)
  select new.id,a.id,ov.id,case when a.data_type='text' then btrim(e.value) end,e.value
  from jsonb_each_text(new.attributes) e
  join public.attribute_definitions a on a.code='legacy_'||md5(lower(btrim(e.key)))
  left join public.attribute_option_values ov on ov.attribute_definition_id=a.id and ov.code=md5(lower(btrim(e.value))) and a.data_type='option'
  where btrim(e.value)<>'';
  delete from public.sku_prices where sku_id=new.id and price_type='reference' and source='legacy_variants.price';
  if new.price is not null then insert into public.sku_prices(sku_id,price_type,price_basis,amount,base_unit_amount,source)
    values(new.id,'reference','base_uom',new.price,new.price,'legacy_variants.price'); end if;
  return new;
end $$;
create trigger trg_sync_legacy_variant_children after insert or update of attributes,unit,price,is_trackable_lot on public.variants
for each row execute function public.sync_legacy_variant_children();

create or replace function public.sync_legacy_product_attributes()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.attribute_definitions(code,name,data_type,allow_custom_value)
  select 'legacy_'||md5(lower(btrim(x))),min(btrim(x)),
    case lower(btrim(x)) when 'hãng sản xuất' then 'option' when 'màu sắc' then 'option' when 'chủng loại' then 'option' else 'text' end,
    not (lower(btrim(x)) in ('hãng sản xuất','màu sắc','chủng loại'))
  from unnest(new.options) x where btrim(x)<>'' group by lower(btrim(x))
  on conflict(code) do update set name=excluded.name,data_type=excluded.data_type,allow_custom_value=excluded.allow_custom_value,is_active=true;
  delete from public.product_attribute_definitions where product_id=new.id;
  insert into public.product_attribute_definitions(product_id,attribute_definition_id,is_required,is_variant_axis,display_order)
  select new.id,a.id,true,true,(o.ordinality-1)::smallint from unnest(new.options) with ordinality o(name,ordinality)
  join public.attribute_definitions a on a.code='legacy_'||md5(lower(btrim(o.name)))
  on conflict(product_id,attribute_definition_id) do update set display_order=excluded.display_order,is_required=true,is_variant_axis=true;
  insert into public.attribute_option_values(attribute_definition_id,code,label)
  select a.id,md5(lower(btrim(e.value))),btrim(e.value)
  from public.variants v cross join lateral jsonb_each_text(v.attributes) e
  join public.attribute_definitions a on a.code='legacy_'||md5(lower(btrim(e.key))) and a.data_type='option'
  where v.product_id=new.id and btrim(e.value)<>''
  on conflict(attribute_definition_id,code) do update set label=excluded.label,is_active=true;
  delete from public.sku_attribute_values sav using public.variants v where sav.sku_id=v.id and v.product_id=new.id;
  insert into public.sku_attribute_values(sku_id,attribute_definition_id,option_value_id,text_value,legacy_text_value)
  select v.id,a.id,ov.id,case when a.data_type='text' then btrim(e.value) end,e.value
  from public.variants v cross join lateral jsonb_each_text(v.attributes) e
  join public.attribute_definitions a on a.code='legacy_'||md5(lower(btrim(e.key)))
  left join public.attribute_option_values ov on ov.attribute_definition_id=a.id
    and ov.code=md5(lower(btrim(e.value))) and a.data_type='option'
  where v.product_id=new.id and btrim(e.value)<>'';
  return new;
end $$;
create trigger trg_sync_legacy_product_attributes after insert or update of options on public.products
for each row execute function public.sync_legacy_product_attributes();

-- Hard local/rehearsal gates. Production acceptance additionally requires Task 1 clone evidence.
do $$
declare v_count bigint;
begin
  select count(*) into v_count from public.variants where sku_code is null or base_unit_id is null;
  if v_count<>0 then raise exception 'SKU backfill incomplete: % rows missing code/base unit',v_count; end if;
  select count(*) into v_count from public.variants v
  where not exists(select 1 from public.sku_transaction_units u where u.sku_id=v.id and u.is_base);
  if v_count<>0 then raise exception 'SKU backfill incomplete: % rows missing base transaction UOM',v_count; end if;
  select count(*) into v_count from public.variant_components vc
  where vc.component_type='assembly' and not exists(select 1 from public.bom_items bi where bi.legacy_component_id=vc.id);
  if v_count<>0 then raise exception 'BOM backfill incomplete: % assembly component rows',v_count; end if;
  select count(*) into v_count from public.catalog_migration_issues where status='open';
  if v_count<>0 then raise exception 'Catalog backfill has % unresolved migration issues',v_count; end if;
end $$;
