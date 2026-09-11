-- 0064_performance_indexes.sql — Thêm các chỉ mục (indexes) tối ưu hóa truy vấn trang chủ, danh sách, báo cáo và kiểm tra RLS

-- 1. Audit Logs (truy vấn hoạt động gần đây sắp xếp created_at desc)
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);

-- 2. Requisitions (lọc status, requester_id, zone_id, sub_zone_id và sắp xếp created_at desc)
create index if not exists idx_requisitions_created_at on public.requisitions (created_at desc);
create index if not exists idx_requisitions_status_created on public.requisitions (status, created_at desc);
create index if not exists idx_requisitions_requester on public.requisitions (requester_id, created_at desc);
create index if not exists idx_requisitions_zone on public.requisitions (zone_id);

-- 3. Receipts (lọc status, supplier_id và sắp xếp created_at desc)
create index if not exists idx_receipts_created_at on public.receipts (created_at desc);
create index if not exists idx_receipts_status_created on public.receipts (status, created_at desc);
create index if not exists idx_receipts_supplier on public.receipts (supplier_id);
create index if not exists idx_receipts_created_by on public.receipts (created_by);

-- 4. Defect Notes (lọc status, reported_by, source_location_id và sắp xếp created_at desc)
create index if not exists idx_defect_notes_created_at on public.defect_notes (created_at desc);
create index if not exists idx_defect_notes_status_created on public.defect_notes (status, created_at desc);
create index if not exists idx_defect_notes_reported_by on public.defect_notes (reported_by);
create index if not exists idx_defect_notes_source_loc on public.defect_notes (source_location_id);

-- 5. Exchange Notes (lọc status, created_by và sắp xếp created_at desc)
create index if not exists idx_exchange_notes_created_at on public.exchange_notes (created_at desc);
create index if not exists idx_exchange_notes_status_created on public.exchange_notes (status, created_at desc);
create index if not exists idx_exchange_notes_created_by on public.exchange_notes (created_by);

-- 6. Liquidation Notes & Repair Orders
create index if not exists idx_liquidation_notes_created_at on public.liquidation_notes (created_at desc);
create index if not exists idx_liquidation_notes_status_created on public.liquidation_notes (status, created_at desc);
create index if not exists idx_repair_orders_created_at on public.repair_orders (created_at desc);
create index if not exists idx_repair_orders_status_created on public.repair_orders (status, created_at desc);

-- 7. Issues (lọc zone_id, customer_id, creator_id)
create index if not exists idx_issues_created_at on public.issues (created_at desc);
create index if not exists idx_issues_zone on public.issues (zone_id);
create index if not exists idx_issues_customer on public.issues (customer_id);
create index if not exists idx_issues_creator on public.issues (creator_id);

-- 8. Stock Movements (báo cáo XNT lọc range created_at và movement_type)
create index if not exists idx_stock_movements_created_at on public.stock_movements (created_at desc);
create index if not exists idx_stock_movements_type_created on public.stock_movements (movement_type, created_at desc);
create index if not exists idx_stock_movements_ref on public.stock_movements (ref_type, ref_id);

-- 9. Stocktake Sessions & Items
create index if not exists idx_stocktake_sessions_created_at on public.stocktake_sessions (created_at desc);
create index if not exists idx_stocktake_items_session on public.stocktake_items (session_id);

-- 10. Catalog & Variants
create index if not exists idx_products_name on public.products (name);
create index if not exists idx_products_deleted_at on public.products (deleted_at) where deleted_at is null;
create index if not exists idx_variants_product_is_default on public.variants (product_id, is_default desc, price asc);
create index if not exists idx_variant_components_parent on public.variant_components (parent_variant_id);
create index if not exists idx_variant_components_child on public.variant_components (child_variant_id);

-- 11. Reference Tables Soft-Delete & Sorts
create index if not exists idx_categories_deleted_display on public.categories (deleted_at, display_order) where deleted_at is null;
create index if not exists idx_zones_deleted_name on public.zones (deleted_at, name) where deleted_at is null;
create index if not exists idx_suppliers_deleted_name on public.suppliers (deleted_at, name) where deleted_at is null;
create index if not exists idx_customers_deleted_name on public.customers (deleted_at, name) where deleted_at is null;
