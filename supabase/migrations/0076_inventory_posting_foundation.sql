-- 0076_inventory_posting_foundation.sql
-- Additive decimal+tracking+ledger schema for the new posting kernel.
-- CRITICAL: Old-runtime enforcement is intentionally NOT activated here.
-- append-only triggers are installed DISABLED and activated only in Task 13
-- after all old revert/delete-based functions are revoked.

-- ── Decimal quantities ─────────────────────────────────────────────────────
-- All quantity columns become numeric(20,6) without data loss (current stock
-- is zero in local evidence; verify before applying to any clone with data).
-- Existing CHECK quantity >= 0 is preserved.

-- Drop dependent views before altering column types; recreate immediately after each alter.
drop view if exists public.location_stock;
drop view if exists public.variant_stock;

alter table public.stock_balances alter column quantity type numeric(20,6) using quantity::numeric(20,6);
alter table public.stock_movements alter column quantity type numeric(20,6) using quantity::numeric(20,6);
alter table public.receipt_items    alter column quantity type numeric(20,6) using quantity::numeric(20,6);
alter table public.issue_items      alter column quantity type numeric(20,6) using quantity::numeric(20,6);
alter table public.requisition_items alter column quantity type numeric(20,6) using quantity::numeric(20,6);
alter table public.requisition_return_items alter column quantity type numeric(20,6) using quantity::numeric(20,6);
alter table public.stocktake_items  alter column system_qty type numeric(20,6) using system_qty::numeric(20,6);
alter table public.stocktake_items  alter column actual_qty  type numeric(20,6) using actual_qty::numeric(20,6);
alter table public.defect_note_items alter column quantity type numeric(20,6) using quantity::numeric(20,6);
alter table public.exchange_note_items alter column quantity type numeric(20,6) using quantity::numeric(20,6);
alter table public.liquidation_items alter column quantity type numeric(20,6) using quantity::numeric(20,6);
alter table public.repair_order_items alter column quantity type numeric(20,6) using quantity::numeric(20,6);
alter table public.tool_borrowing_items alter column quantity type numeric(20,6) using quantity::numeric(20,6);


-- Recreate legacy views with identical semantics; quantity now numeric(20,6).
create or replace view public.variant_stock as
 select v.id as variant_id, v.product_id, v.min_stock, v.unit,
   case when exists(select 1 from variant_components vc where vc.parent_variant_id=v.id)
     then coalesce((select min(sb.quantity / greatest(vc.quantity,1))
                    from variant_components vc join stock_balances sb on sb.variant_id=vc.child_variant_id
                    join stock_locations sl on sl.id=sb.location_id and sl.code='KHO_CHINH'
                    where vc.parent_variant_id=v.id), 0)
     else coalesce((select sb.quantity from stock_balances sb
                    join stock_locations sl on sl.id=sb.location_id and sl.code='KHO_CHINH'
                    where sb.variant_id=v.id), 0)
   end as quantity
 from variants v;

create or replace view public.location_stock as
 select loc.location_id, v.id as variant_id, v.product_id,
   case when exists(select 1 from variant_components vc where vc.parent_variant_id=v.id)
     then coalesce((select min(sb.quantity / greatest(vc.quantity,1))
                    from variant_components vc join stock_balances sb on sb.variant_id=vc.child_variant_id and sb.location_id=loc.location_id
                    where vc.parent_variant_id=v.id), 0)
     else coalesce((select sb.quantity from stock_balances sb where sb.variant_id=v.id and sb.location_id=loc.location_id), 0)
   end as quantity
 from variants v cross join (select distinct location_id from stock_balances) loc;

-- ── Movement ledger: append-only fields and snapshot columns ───────────────
alter table public.stock_movements
 add column if not exists base_unit_id uuid references public.units(id),
 add column if not exists entered_quantity numeric(20,6),
 add column if not exists transaction_unit_id uuid references public.sku_transaction_units(id),
 add column if not exists conversion_factor_snapshot numeric(20,9),
 add column if not exists base_quantity numeric(20,6),
 add column if not exists unit_cost numeric(20,6),
 add column if not exists sku_name_snapshot text,
 add column if not exists uom_name_snapshot text,
 add column if not exists snapshot_quality text not null default 'legacy_unknown'
              check (snapshot_quality in ('complete','legacy_unknown')),
 add column if not exists idempotency_key text,
 add column if not exists reversal_of_movement_id uuid references public.stock_movements(id),
 add column if not exists bom_version_id uuid references public.bom_versions(id);

create unique index if not exists stock_movements_idempotency_key_unique
  on public.stock_movements(idempotency_key) where idempotency_key is not null;
create index if not exists stock_movements_sku_location_time
  on public.stock_movements(variant_id, coalesce(from_location_id,to_location_id), created_at desc);
create index if not exists stock_movements_ref_doc
  on public.stock_movements(ref_type, ref_id) where ref_id is not null;
create index if not exists stock_movements_reversal
  on public.stock_movements(reversal_of_movement_id) where reversal_of_movement_id is not null;

-- ── Reserved (soft-allocated) quantity on balances ─────────────────────────
alter table public.stock_balances
 add column if not exists reserved_quantity numeric(20,6) not null default 0
              check (reserved_quantity >= 0),
 add column if not exists base_unit_id uuid references public.units(id);

-- Update balance base_unit_id from the SKU's canonical mapping
update public.stock_balances sb
set base_unit_id = v.base_unit_id
from public.variants v where v.id = sb.variant_id and v.base_unit_id is not null;

-- ── Lot tracking ───────────────────────────────────────────────────────────
create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.variants(id),
  lot_number text not null,
  expiry_date date,
  migration_status text not null default 'resolved'
    check (migration_status in ('resolved','legacy_unresolved')),
  status text not null default 'active'
    check (status in ('active','quarantined','expired','exhausted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sku_id, lot_number)
);

create table public.lot_stock_balances (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.inventory_lots(id) on delete cascade,
  location_id uuid not null references public.stock_locations(id) on delete cascade,
  quantity numeric(20,6) not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (lot_id, location_id)
);

create index if not exists inventory_lots_sku on public.inventory_lots(sku_id);
create index if not exists inventory_lots_expiry on public.inventory_lots(expiry_date) where expiry_date is not null;
create index if not exists lot_stock_balances_lot on public.lot_stock_balances(lot_id);
create index if not exists lot_stock_balances_location on public.lot_stock_balances(location_id);

-- ── Serial tracking ────────────────────────────────────────────────────────
create table public.serial_items (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.variants(id),
  lot_id uuid references public.inventory_lots(id),
  serial_code text not null,
  location_id uuid references public.stock_locations(id),
  status text not null default 'available'
    check (status in ('available','reserved','issued','defect','repair','liquidated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sku_id, serial_code)
);

create index if not exists serial_items_location on public.serial_items(location_id) where location_id is not null;
create index if not exists serial_items_status on public.serial_items(sku_id, status);

-- ── Movement allocations (lot/serial per movement) ─────────────────────────
create table public.stock_movement_allocations (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.stock_movements(id),
  lot_id uuid references public.inventory_lots(id),
  serial_id uuid references public.serial_items(id),
  base_quantity numeric(20,6) not null check (base_quantity > 0),
  created_at timestamptz not null default now(),
  check (num_nonnulls(lot_id, serial_id) <= 1)
);

create index if not exists stock_movement_allocations_movement on public.stock_movement_allocations(movement_id);
create index if not exists stock_movement_allocations_lot on public.stock_movement_allocations(lot_id) where lot_id is not null;
create index if not exists stock_movement_allocations_serial on public.stock_movement_allocations(serial_id) where serial_id is not null;

-- ── Reservations ───────────────────────────────────────────────────────────
create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.variants(id),
  location_id uuid not null references public.stock_locations(id),
  source_document_type text not null,
  source_document_id uuid not null,
  source_document_line_id uuid,
  base_unit_id uuid references public.units(id),
  reserved_quantity numeric(20,6) not null check (reserved_quantity > 0),
  consumed_quantity numeric(20,6) not null default 0 check (consumed_quantity >= 0),
  status text not null default 'active'
    check (status in ('active','partially_consumed','consumed','released','expired')),
  bom_version_id uuid references public.bom_versions(id),
  idempotency_key text,
  command_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (consumed_quantity <= reserved_quantity),
  unique (source_document_type, source_document_line_id, sku_id)
);

create unique index if not exists stock_reservations_idempotency_key_unique
  on public.stock_reservations(idempotency_key) where idempotency_key is not null;
create index if not exists stock_reservations_sku_location on public.stock_reservations(sku_id, location_id, status);
create index if not exists stock_reservations_source_doc on public.stock_reservations(source_document_type, source_document_id);

create table public.stock_reservation_allocations (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.stock_reservations(id) on delete cascade,
  lot_id uuid references public.inventory_lots(id),
  serial_id uuid references public.serial_items(id),
  reserved_quantity numeric(20,6) not null check (reserved_quantity > 0),
  consumed_quantity numeric(20,6) not null default 0 check (consumed_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (consumed_quantity <= reserved_quantity),
  check (num_nonnulls(lot_id, serial_id) <= 1)
);

create index if not exists stock_reservation_allocations_reservation
  on public.stock_reservation_allocations(reservation_id);

-- ── Append-only enforcement function (DISABLED until Task 13) ──────────────
-- Installed but NOT attached to triggers so old runtime can still operate.
-- Task 13 cutover will attach this BEFORE granting the new posting kernel
-- and AFTER revoking all old delete/update paths.
create or replace function public.enforce_movement_append_only()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  raise exception
    'stock_movements is append-only after catalog cutover; cancel = reversal movement';
  return null;
end $$;

comment on function public.enforce_movement_append_only() is
  'INSTALL DISABLED. Attach via Task 13 cutover migration only after revoking old revert helpers.';

-- ── Lot migration: backfill deterministic historical lot rows ──────────────
-- Only receipt_items with non-blank batch_no yield real lot entities.
-- All other historical movements are marked legacy_unknown on their snapshot.
insert into public.inventory_lots(sku_id, lot_number, expiry_date, migration_status, status)
select distinct ri.variant_id, btrim(ri.batch_no),
  ri.expiry_date,
  'resolved',
  case when ri.expiry_date is not null and ri.expiry_date < current_date then 'expired' else 'active' end
from public.receipt_items ri
where nullif(btrim(ri.batch_no), '') is not null
on conflict (sku_id, lot_number) do update
  set expiry_date = excluded.expiry_date,
      status = excluded.status,
      updated_at = now();

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.inventory_lots enable row level security;
alter table public.lot_stock_balances enable row level security;
alter table public.serial_items enable row level security;
alter table public.stock_movement_allocations enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.stock_reservation_allocations enable row level security;

create policy lot_select on public.inventory_lots for select to authenticated using (true);
create policy lot_write on public.inventory_lots for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy lot_balance_select on public.lot_stock_balances for select to authenticated using (true);
create policy lot_balance_write on public.lot_stock_balances for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy serial_select on public.serial_items for select to authenticated using (true);
create policy serial_write on public.serial_items for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy movement_alloc_select on public.stock_movement_allocations for select to authenticated using (true);
create policy movement_alloc_write on public.stock_movement_allocations for all to authenticated using (public.is_warehouse()) with check (public.is_warehouse());
create policy reservation_select on public.stock_reservations for select to authenticated using (true);
create policy reservation_write on public.stock_reservations for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy reservation_alloc_select on public.stock_reservation_allocations for select to authenticated using (true);
create policy reservation_alloc_write on public.stock_reservation_allocations for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- Updated-at triggers for new tables
create trigger trg_lot_updated before update on public.inventory_lots for each row execute function public.set_updated_at();
create trigger trg_lot_balance_updated before update on public.lot_stock_balances for each row execute function public.set_updated_at();
create trigger trg_serial_updated before update on public.serial_items for each row execute function public.set_updated_at();
create trigger trg_reservation_updated before update on public.stock_reservations for each row execute function public.set_updated_at();
create trigger trg_reservation_alloc_updated before update on public.stock_reservation_allocations for each row execute function public.set_updated_at();
