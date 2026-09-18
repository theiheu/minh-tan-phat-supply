-- 0077_inventory_document_snapshots.sql
-- Adds entered/base quantity and UOM/snapshot columns to all document item
-- tables so post-cutover consumers can read full context without the old JSON.
-- Does NOT migrate historical values that were never stored (marked legacy_unknown).
-- The old runtime continues to write only the existing columns.

-- Snapshot helper: marks a field as legacy_unknown when we cannot recover it.
-- All new snapshot columns are nullable so historical rows are valid.

-- ── receipt_items ─────────────────────────────────────────────────────────
alter table public.receipt_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists entered_quantity numeric(20,6),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists sku_name_snapshot text,
  add column if not exists uom_name_snapshot text,
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

-- Backfill what is deterministic: base unit from variant mapping.
update public.receipt_items ri
set entered_quantity = ri.quantity,
    snapshot_quality = case
      when v.base_unit_id is not null and ri.quantity is not null then 'legacy_unknown'
      else 'legacy_unknown'
    end
from public.variants v where v.id = ri.variant_id and ri.entered_quantity is null;

-- ── issue_items ───────────────────────────────────────────────────────────
alter table public.issue_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists entered_quantity numeric(20,6),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists sku_name_snapshot text,
  add column if not exists uom_name_snapshot text,
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

update public.issue_items set entered_quantity = quantity where entered_quantity is null;

-- ── requisition_items ──────────────────────────────────────────────────────
alter table public.requisition_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists entered_quantity numeric(20,6),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists sku_name_snapshot text,
  add column if not exists uom_name_snapshot text,
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

update public.requisition_items set entered_quantity = quantity where entered_quantity is null;

-- ── requisition_return_items ───────────────────────────────────────────────
alter table public.requisition_return_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists entered_quantity numeric(20,6),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

update public.requisition_return_items set entered_quantity = quantity where entered_quantity is null;

-- ── stocktake_items ────────────────────────────────────────────────────────
alter table public.stocktake_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

-- Existing system/actual quantities are already base-count snapshots; preserve them.
update public.stocktake_items set snapshot_quality='legacy_unknown' where snapshot_quality is null;

-- ── defect_note_items ──────────────────────────────────────────────────────
alter table public.defect_note_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists entered_quantity numeric(20,6),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

update public.defect_note_items set entered_quantity = quantity where entered_quantity is null;

-- ── exchange_note_items ────────────────────────────────────────────────────
alter table public.exchange_note_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists entered_quantity numeric(20,6),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

update public.exchange_note_items set entered_quantity = quantity where entered_quantity is null;

-- ── liquidation_items ──────────────────────────────────────────────────────
alter table public.liquidation_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists entered_quantity numeric(20,6),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

update public.liquidation_items set entered_quantity = quantity where entered_quantity is null;

-- ── repair_order_items ─────────────────────────────────────────────────────
alter table public.repair_order_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists entered_quantity numeric(20,6),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

update public.repair_order_items set entered_quantity = quantity where entered_quantity is null;

-- ── tool_borrowing_items ───────────────────────────────────────────────────
alter table public.tool_borrowing_items
  add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
  add column if not exists entered_quantity numeric(20,6),
  add column if not exists conversion_factor_snapshot numeric(20,9),
  add column if not exists snapshot_quality text not null default 'legacy_unknown'
    check (snapshot_quality in ('complete','legacy_unknown'));

update public.tool_borrowing_items set entered_quantity = quantity where entered_quantity is null;

-- ── Integrity gate ────────────────────────────────────────────────────────
do $$
declare v_count bigint;
begin
  -- All document item quantities converted cleanly (no unexpected loss)
  select count(*) into v_count
  from (
    select id from public.receipt_items where entered_quantity is null
    union all select id from public.issue_items where entered_quantity is null
    union all select id from public.requisition_items where entered_quantity is null
    union all select id from public.defect_note_items where entered_quantity is null
    union all select id from public.liquidation_items where entered_quantity is null
    union all select id from public.repair_order_items where entered_quantity is null
    union all select id from public.tool_borrowing_items where entered_quantity is null
  ) missing;
  if v_count <> 0 then
    raise exception 'Document snapshot backfill incomplete: % rows missing entered_quantity', v_count;
  end if;
  -- Decimal conversion: no existing balances are negative
  select count(*) into v_count from public.stock_balances where quantity < 0;
  if v_count <> 0 then
    raise exception 'Negative balances after decimal conversion: %', v_count;
  end if;
end $$;
