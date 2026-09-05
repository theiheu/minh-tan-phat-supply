-- 0016_rls.sql — Row Level Security (mục 11)
-- Quy ước: mọi policy dùng `to authenticated` (không rò ra anon).
-- Mọi thay đổi stock/chuyển trạng thái chạy qua RPC security definer (bỏ qua RLS của owner).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Chống leo quyền: requester không được tự đổi role/zone_id.
create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer as $$
begin
  if new.role is distinct from old.role or new.zone_id is distinct from old.zone_id then
    raise exception 'Không được tự đổi role/zone';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_no_escalation
  before update on public.profiles for each row
  when (auth.uid() = old.id and not public.is_manager())
  execute function public.prevent_role_escalation();

-- ---------------------------------------------------------------------------
-- Danh mục dùng chung: SELECT authenticated, ghi manager
-- categories / zones / suppliers / products / variants / variant_components / stock_locations
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.zones enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.variant_components enable row level security;
alter table public.stock_locations enable row level security;

create policy "categories_select" on public.categories for select to authenticated using (true);
create policy "categories_insert" on public.categories for insert to authenticated with check (public.is_manager());
create policy "categories_update" on public.categories for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "categories_delete" on public.categories for delete to authenticated using (public.is_manager());

create policy "zones_select" on public.zones for select to authenticated using (true);
create policy "zones_insert" on public.zones for insert to authenticated with check (public.is_manager());
create policy "zones_update" on public.zones for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "zones_delete" on public.zones for delete to authenticated using (public.is_manager());

create policy "suppliers_select" on public.suppliers for select to authenticated using (true);
create policy "suppliers_insert" on public.suppliers for insert to authenticated with check (public.is_manager());
create policy "suppliers_update" on public.suppliers for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "suppliers_delete" on public.suppliers for delete to authenticated using (public.is_manager());

create policy "products_select" on public.products for select to authenticated using (true);
create policy "products_insert" on public.products for insert to authenticated with check (public.is_manager());
create policy "products_update" on public.products for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "products_delete" on public.products for delete to authenticated using (public.is_manager());

create policy "variants_select" on public.variants for select to authenticated using (true);
create policy "variants_insert" on public.variants for insert to authenticated with check (public.is_manager());
create policy "variants_update" on public.variants for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "variants_delete" on public.variants for delete to authenticated using (public.is_manager());

create policy "variant_components_select" on public.variant_components for select to authenticated using (true);
create policy "variant_components_insert" on public.variant_components for insert to authenticated with check (public.is_manager());
create policy "variant_components_update" on public.variant_components for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "variant_components_delete" on public.variant_components for delete to authenticated using (public.is_manager());

create policy "stock_locations_select" on public.stock_locations for select to authenticated using (true);
create policy "stock_locations_insert" on public.stock_locations for insert to authenticated with check (public.is_manager());
create policy "stock_locations_update" on public.stock_locations for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "stock_locations_delete" on public.stock_locations for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- stock_balances / stock_movements (ledger)
-- ---------------------------------------------------------------------------
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;

create policy "stock_balances_select" on public.stock_balances for select to authenticated using (true);
create policy "stock_balances_insert" on public.stock_balances for insert to authenticated with check (public.is_manager());
create policy "stock_balances_update" on public.stock_balances for update to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "stock_movements_select" on public.stock_movements for select to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- requisitions + requisition_items
-- ---------------------------------------------------------------------------
alter table public.requisitions enable row level security;
alter table public.requisition_items enable row level security;

create policy "requisitions_select" on public.requisitions for select to authenticated
  using (auth.uid() = requester_id or public.is_manager());
create policy "requisitions_insert" on public.requisitions for insert to authenticated
  with check (auth.uid() = requester_id);
create policy "requisitions_update" on public.requisitions for update to authenticated
  using (public.is_manager() or (auth.uid() = requester_id and status in ('draft','pending')))
  with check (public.is_manager() or (auth.uid() = requester_id and status in ('draft','pending')));
create policy "requisitions_delete" on public.requisitions for delete to authenticated
  using (auth.uid() = requester_id and status = 'draft');

create policy "requisition_items_select" on public.requisition_items for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.requisitions r where r.id = requisition_id and r.requester_id = auth.uid()
  ));
create policy "requisition_items_insert" on public.requisition_items for insert to authenticated
  with check (public.is_manager() or exists (
    select 1 from public.requisitions r where r.id = requisition_id and r.requester_id = auth.uid()
  ));
create policy "requisition_items_update" on public.requisition_items for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "requisition_items_delete" on public.requisition_items for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- receipts + receipt_items (manager only)
-- ---------------------------------------------------------------------------
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;

create policy "receipts_select" on public.receipts for select to authenticated using (public.is_manager());
create policy "receipts_insert" on public.receipts for insert to authenticated with check (public.is_manager());
create policy "receipts_update" on public.receipts for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "receipts_delete" on public.receipts for delete to authenticated using (public.is_manager());

create policy "receipt_items_select" on public.receipt_items for select to authenticated using (public.is_manager());
create policy "receipt_items_insert" on public.receipt_items for insert to authenticated with check (public.is_manager());
create policy "receipt_items_update" on public.receipt_items for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "receipt_items_delete" on public.receipt_items for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- defect_notes + defect_note_items
-- ---------------------------------------------------------------------------
alter table public.defect_notes enable row level security;
alter table public.defect_note_items enable row level security;

create policy "defect_notes_select" on public.defect_notes for select to authenticated
  using (auth.uid() = reported_by or public.is_manager());
create policy "defect_notes_insert" on public.defect_notes for insert to authenticated
  with check (auth.uid() = reported_by or public.is_manager());
create policy "defect_notes_update" on public.defect_notes for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "defect_notes_delete" on public.defect_notes for delete to authenticated using (public.is_manager());

create policy "defect_note_items_select" on public.defect_note_items for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.defect_notes d where d.id = defect_note_id and d.reported_by = auth.uid()
  ));
create policy "defect_note_items_insert" on public.defect_note_items for insert to authenticated
  with check (public.is_manager() or exists (
    select 1 from public.defect_notes d where d.id = defect_note_id and d.reported_by = auth.uid()
  ));
create policy "defect_note_items_update" on public.defect_note_items for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "defect_note_items_delete" on public.defect_note_items for delete to authenticated using (public.is_manager());

-- ---------------------------------------------------------------------------
-- repair / liquidation / stocktake / audit (manager only)
-- ---------------------------------------------------------------------------
alter table public.repair_orders enable row level security;
alter table public.repair_order_items enable row level security;
alter table public.liquidation_notes enable row level security;
alter table public.liquidation_items enable row level security;
alter table public.stocktake_sessions enable row level security;
alter table public.stocktake_items enable row level security;
alter table public.audit_logs enable row level security;

create policy "repair_orders_select" on public.repair_orders for select to authenticated using (public.is_manager());
create policy "repair_orders_insert" on public.repair_orders for insert to authenticated with check (public.is_manager());
create policy "repair_orders_update" on public.repair_orders for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "repair_orders_delete" on public.repair_orders for delete to authenticated using (public.is_manager());

create policy "repair_order_items_select" on public.repair_order_items for select to authenticated using (public.is_manager());
create policy "repair_order_items_insert" on public.repair_order_items for insert to authenticated with check (public.is_manager());
create policy "repair_order_items_update" on public.repair_order_items for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "repair_order_items_delete" on public.repair_order_items for delete to authenticated using (public.is_manager());

create policy "liquidation_notes_select" on public.liquidation_notes for select to authenticated using (public.is_manager());
create policy "liquidation_notes_insert" on public.liquidation_notes for insert to authenticated with check (public.is_manager());
create policy "liquidation_notes_update" on public.liquidation_notes for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "liquidation_notes_delete" on public.liquidation_notes for delete to authenticated using (public.is_manager());

create policy "liquidation_items_select" on public.liquidation_items for select to authenticated using (public.is_manager());
create policy "liquidation_items_insert" on public.liquidation_items for insert to authenticated with check (public.is_manager());
create policy "liquidation_items_update" on public.liquidation_items for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "liquidation_items_delete" on public.liquidation_items for delete to authenticated using (public.is_manager());

create policy "stocktake_sessions_select" on public.stocktake_sessions for select to authenticated using (public.is_manager());
create policy "stocktake_sessions_insert" on public.stocktake_sessions for insert to authenticated with check (public.is_manager());
create policy "stocktake_sessions_update" on public.stocktake_sessions for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "stocktake_sessions_delete" on public.stocktake_sessions for delete to authenticated using (public.is_manager());

create policy "stocktake_items_select" on public.stocktake_items for select to authenticated using (public.is_manager());
create policy "stocktake_items_insert" on public.stocktake_items for insert to authenticated with check (public.is_manager());
create policy "stocktake_items_update" on public.stocktake_items for update to authenticated using (public.is_manager()) with check (public.is_manager());
create policy "stocktake_items_delete" on public.stocktake_items for delete to authenticated using (public.is_manager());

create policy "audit_logs_select" on public.audit_logs for select to authenticated using (public.is_manager());
