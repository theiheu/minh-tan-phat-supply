-- Migration 0100: Metabase BI Analytics Views & Readonly User
-- Description: Sets up optimized Analytical Views and Metabase readonly role for BI dashboards.

-- The login and its password are provisioned outside migrations by operations.
-- This migration only grants the minimum schema access required by approved BI views.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'metabase_readonly') THEN
    CREATE ROLE metabase_readonly NOLOGIN;
  END IF;
END $$;

GRANT CONNECT ON DATABASE postgres TO metabase_readonly;
GRANT USAGE ON SCHEMA public TO metabase_readonly;

-- =============================================================================
-- 1. View: v_bi_subzone_cost_breakdown (Phân bổ chi phí theo Khu & Dãy trại)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_bi_subzone_cost_breakdown AS
SELECT
  i.id AS issue_id,
  i.code AS issue_code,
  i.created_at::DATE AS issue_date,
  DATE_TRUNC('month', i.created_at)::DATE AS report_month,
  DATE_TRUNC('week', i.created_at)::DATE AS report_week,
  z.id AS zone_id,
  COALESCE(z.name, 'Chưa phân khu') AS zone_name,
  sz.id AS sub_zone_id,
  COALESCE(sz.name, 'Khu vực chung / Khách hàng') AS sub_zone_name,
  c.id AS category_id,
  COALESCE(c.name, 'Khác') AS category_name,
  s.id AS sku_id,
  COALESCE(s.sku_code, 'NO-SKU') AS sku_code,
  p.name AS product_name,
  COALESCE(u.name, 'Đơn vị') AS unit_name,
  ii.quantity,
  COALESCE(ii.unit_price, s.price, 0) AS unit_price,
  (ii.quantity * COALESCE(ii.unit_price, s.price, 0)) AS total_cost_vnd,
  i.destination_type,
  i.status AS issue_status,
  prof.name AS creator_name
FROM issues i
JOIN issue_items ii ON ii.issue_id = i.id
JOIN skus s ON ii.sku_id = s.id
JOIN products p ON s.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN units u ON s.base_unit_id = u.id
LEFT JOIN sub_zones sz ON i.sub_zone_id = sz.id
LEFT JOIN zones z ON COALESCE(i.zone_id, sz.zone_id) = z.id
LEFT JOIN profiles prof ON i.creator_id = prof.id
WHERE i.status = 'posted';

-- =============================================================================
-- 2. View: v_bi_inventory_xnt_summary (Tổng hợp Tồn kho & Sức khỏe kho)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_bi_inventory_xnt_summary AS
SELECT
  s.id AS sku_id,
  COALESCE(s.sku_code, 'NO-SKU') AS sku_code,
  p.name AS product_name,
  COALESCE(c.name, 'Khác') AS category_name,
  COALESCE(u.name, 'Đơn vị') AS base_unit,
  loc.id AS location_id,
  loc.code AS location_code,
  loc.name AS location_name,
  COALESCE(sb.quantity, 0) AS current_balance,
  s.min_stock AS min_stock_level,
  COALESCE(s.price, 0) AS unit_price,
  (COALESCE(sb.quantity, 0) * COALESCE(s.price, 0)) AS total_stock_value,
  CASE
    WHEN COALESCE(sb.quantity, 0) <= 0 THEN 'Hết hàng (Out of Stock)'
    WHEN s.min_stock > 0 AND COALESCE(sb.quantity, 0) < s.min_stock THEN 'Dưới định mức tối thiểu (Low Stock)'
    ELSE 'Tồn an toàn (Normal)'
  END AS inventory_health_status,
  s.sku_status,
  s.inventory_policy
FROM skus s
JOIN products p ON s.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN units u ON s.base_unit_id = u.id
CROSS JOIN stock_locations loc
LEFT JOIN stock_balances sb ON sb.sku_id = s.id AND sb.location_id = loc.id
WHERE s.sku_status = 'active' AND p.deleted_at IS NULL;

-- =============================================================================
-- 3. View: v_bi_fleet_fuel_efficiency (Giám sát bồn dầu & Đội xe cơ giới)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_bi_fleet_fuel_efficiency AS
SELECT
  fd.id AS dispense_id,
  fd.code AS dispense_code,
  v.id AS vehicle_id,
  v.code AS vehicle_code,
  v.name AS vehicle_name,
  v.type AS vehicle_type,
  v.odo_unit,
  v.fuel_norm,
  COALESCE(fd.driver_name, v.default_driver, 'Chưa xác định') AS driver_name,
  fd.created_at::DATE AS dispense_date,
  DATE_TRUNC('month', fd.created_at)::DATE AS report_month,
  fd.quantity AS liters_dispensed,
  fd.previous_odo,
  fd.current_odo,
  fd.usage_diff,
  fd.consumption_rate,
  CASE
    WHEN v.fuel_norm IS NOT NULL AND fd.consumption_rate IS NOT NULL AND fd.consumption_rate > (v.fuel_norm * 1.2) THEN true
    ELSE false
  END AS is_abnormal_consumption,
  fd.notes,
  fd.status AS dispense_status
FROM fuel_dispenses fd
JOIN vehicles v ON fd.vehicle_id = v.id
WHERE fd.status = 'completed';

-- =============================================================================
-- 4. View: v_bi_equipment_defects_and_repairs (Sự cố & Chi phí bảo trì sửa chữa)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_bi_equipment_defects_and_repairs AS
SELECT
  dn.id AS defect_note_id,
  dn.code AS defect_code,
  dn.created_at::DATE AS defect_date,
  DATE_TRUNC('month', dn.created_at)::DATE AS report_month,
  loc.name AS source_location_name,
  s.id AS sku_id,
  COALESCE(s.sku_code, 'NO-SKU') AS sku_code,
  p.name AS equipment_name,
  COALESCE(c.name, 'Cơ điện') AS category_name,
  dni.quantity AS defect_qty,
  dni.damage_detail,
  dni.damage_type,
  dni.severity,
  dni.resolution,
  dn.status AS defect_status,
  COALESCE(ro.code, 'Chưa có phiếu sửa') AS repair_code,
  ro.vendor AS repair_vendor,
  ro.status AS repair_status,
  COALESCE(ro.total_cost, 0) AS repair_cost_vnd,
  COALESCE(s.price, 0) AS new_equipment_price_vnd,
  prof.name AS reporter_name
FROM defect_notes dn
JOIN defect_note_items dni ON dni.defect_note_id = dn.id
JOIN skus s ON dni.sku_id = s.id
JOIN products p ON s.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN stock_locations loc ON dn.source_location_id = loc.id
LEFT JOIN repair_order_items roi ON roi.defect_item_id = dni.id
LEFT JOIN repair_orders ro ON roi.repair_order_id = ro.id
LEFT JOIN profiles prof ON dn.reported_by = prof.id;

-- =============================================================================
-- 5. View: v_bi_supplier_procurement_history (Mua hàng & Biến động giá NCC)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_bi_supplier_procurement_history AS
SELECT
  r.id AS receipt_id,
  r.code AS receipt_code,
  r.created_at::DATE AS receipt_date,
  DATE_TRUNC('month', r.created_at)::DATE AS report_month,
  sup.id AS supplier_id,
  COALESCE(sup.name, 'Nhà cung cấp vãng lai') AS supplier_name,
  CASE WHEN array_length(r.invoice_images, 1) > 0 THEN true ELSE false END AS has_invoice_images,
  s.id AS sku_id,
  COALESCE(s.sku_code, 'NO-SKU') AS sku_code,
  p.name AS product_name,
  COALESCE(c.name, 'Khác') AS category_name,
  COALESCE(u.name, 'Đơn vị') AS unit_name,
  ri.quantity,
  COALESCE(ri.unit_cost, s.price, 0) AS unit_cost,
  (ri.quantity * COALESCE(ri.unit_cost, s.price, 0)) AS line_total_vnd,
  r.status AS receipt_status,
  creator.name AS creator_name,
  approver.name AS approver_name
FROM receipts r
JOIN receipt_items ri ON ri.receipt_id = r.id
JOIN skus s ON ri.sku_id = s.id
JOIN products p ON s.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN units u ON s.base_unit_id = u.id
LEFT JOIN suppliers sup ON r.supplier_id = sup.id
LEFT JOIN profiles creator ON r.created_by = creator.id
LEFT JOIN profiles approver ON r.approved_by = approver.id
WHERE r.status IN ('approved', 'posted');

-- =============================================================================
-- 6. View: v_bi_tool_borrowing_status (Mượn trả đồ nghề & Cảnh báo quá hạn)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_bi_tool_borrowing_status AS
SELECT
  tb.id AS borrowing_id,
  tb.code AS borrowing_code,
  tb.borrowed_at::DATE AS borrow_date,
  tb.expected_return_date,
  tb.returned_at::DATE AS actual_return_date,
  DATE_TRUNC('month', tb.borrowed_at)::DATE AS report_month,
  z.name AS zone_name,
  sz.name AS sub_zone_name,
  p.name AS borrower_name,
  s.id AS sku_id,
  COALESCE(s.sku_code, 'NO-SKU') AS sku_code,
  prod.name AS tool_name,
  tbi.quantity,
  tbi.returned_quantity,
  tb.status,
  tb.purpose,
  CASE
    WHEN tb.status = 'borrowed' AND tb.expected_return_date < CURRENT_DATE THEN true
    ELSE false
  END AS is_overdue,
  CASE
    WHEN tb.status = 'borrowed' AND tb.expected_return_date < CURRENT_DATE THEN
      (CURRENT_DATE - tb.expected_return_date)
    ELSE 0
  END AS days_overdue
FROM tool_borrowings tb
JOIN tool_borrowing_items tbi ON tbi.borrowing_id = tb.id
JOIN skus s ON tbi.sku_id = s.id
JOIN products prod ON s.product_id = prod.id
JOIN profiles p ON tb.borrower_id = p.id
LEFT JOIN sub_zones sz ON tb.sub_zone_id = sz.id
LEFT JOIN zones z ON COALESCE(tb.zone_id, sz.zone_id) = z.id;

-- =============================================================================
-- 7. View: v_bi_executive_kpis (Chỉ số tổng hợp dành cho Ban Giám Đốc)
-- =============================================================================
CREATE OR REPLACE VIEW public.v_bi_executive_kpis AS
SELECT
  (SELECT COUNT(*) FROM skus WHERE sku_status = 'active') AS total_active_skus,
  (SELECT COALESCE(SUM(sb.quantity * COALESCE(s.price, 0)), 0) FROM stock_balances sb JOIN skus s ON sb.sku_id = s.id) AS total_inventory_value_vnd,
  (SELECT COALESCE(SUM(ii.quantity * COALESCE(ii.unit_price, s.price, 0)), 0) 
   FROM issues i 
   JOIN issue_items ii ON ii.issue_id = i.id 
   JOIN skus s ON ii.sku_id = s.id 
   WHERE i.status = 'posted' AND i.created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS mtd_issued_cost_vnd,
  (SELECT COALESCE(SUM(ri.quantity * COALESCE(ri.unit_cost, s.price, 0)), 0) 
   FROM receipts r 
   JOIN receipt_items ri ON ri.receipt_id = r.id 
   JOIN skus s ON ri.sku_id = s.id 
   WHERE r.status IN ('approved', 'posted') AND r.created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS mtd_procurement_cost_vnd,
  (SELECT COALESCE(SUM(quantity), 0) FROM fuel_dispenses WHERE status = 'completed' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS mtd_fuel_liters,
  (SELECT COUNT(*) FROM defect_notes WHERE status IN ('staging', 'in_repair')) AS active_defect_incidents,
  (SELECT COUNT(*) FROM tool_borrowings WHERE status = 'borrowed' AND expected_return_date < CURRENT_DATE) AS overdue_borrowings_count;
-- Grant only the curated BI contract; never grant all current or future public tables.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM metabase_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM metabase_readonly;
GRANT SELECT ON TABLE
  public.v_bi_subzone_cost_breakdown,
  public.v_bi_inventory_xnt_summary,
  public.v_bi_fleet_fuel_efficiency,
  public.v_bi_equipment_defects_and_repairs,
  public.v_bi_supplier_procurement_history,
  public.v_bi_tool_borrowing_status,
  public.v_bi_executive_kpis
TO metabase_readonly;
