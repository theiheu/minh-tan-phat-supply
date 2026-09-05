-- 0014_triggers.sql — updated_at cho mọi bảng có updated_at
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_categories_updated before update on public.categories for each row execute function public.set_updated_at();
create trigger trg_zones_updated before update on public.zones for each row execute function public.set_updated_at();
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_suppliers_updated before update on public.suppliers for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger trg_variants_updated before update on public.variants for each row execute function public.set_updated_at();
create trigger trg_stock_locations_updated before update on public.stock_locations for each row execute function public.set_updated_at();
create trigger trg_defect_notes_updated before update on public.defect_notes for each row execute function public.set_updated_at();
create trigger trg_repair_orders_updated before update on public.repair_orders for each row execute function public.set_updated_at();
create trigger trg_liquidation_notes_updated before update on public.liquidation_notes for each row execute function public.set_updated_at();
create trigger trg_requisitions_updated before update on public.requisitions for each row execute function public.set_updated_at();
create trigger trg_receipts_updated before update on public.receipts for each row execute function public.set_updated_at();
