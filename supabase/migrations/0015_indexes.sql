-- 0015_indexes.sql — indexes
create index idx_products_category on public.products(category_id);
create index idx_variants_product on public.variants(product_id);
create index idx_balances_variant on public.stock_balances(variant_id);
create index idx_balances_location on public.stock_balances(location_id);
create index idx_movements_variant on public.stock_movements(variant_id);
create index idx_movements_type on public.stock_movements(movement_type);
create index idx_requisitions_status on public.requisitions(status);
-- 1 defect chỉ được tạo 1 phiếu đổi mới (chống tạo trùng)
create unique index idx_requisitions_unique_replacement
  on public.requisitions (linked_defect_id)
  where requisition_type = 'replacement' and linked_defect_id is not null;
create index idx_requisition_items_req on public.requisition_items(requisition_id);
create index idx_receipt_items_receipt on public.receipt_items(receipt_id);
create index idx_defect_items_note on public.defect_note_items(defect_note_id);
create index idx_repair_items_order on public.repair_order_items(repair_order_id);
create index idx_liquidation_items_note on public.liquidation_items(liquidation_note_id);
create index idx_audit_entity on public.audit_logs(entity_type, entity_id);
