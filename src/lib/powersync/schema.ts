import { column, Schema, Table } from "@powersync/web";

/**
 * Danh mục nhóm vật tư (Categories)
 */
export const categories = new Table({
  name: column.text,
  icon: column.text,
  display_order: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

/**
 * Danh mục vật tư cấp Product (Products)
 */
export const products = new Table({
  name: column.text,
  description: column.text,
  images: column.text, // JSON array string
  category_id: column.text,
  catalog_status: column.text,
  search_keywords: column.text, // JSON array string
  internal_notes: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

/**
 * Đơn vị tính quy chuẩn (Units)
 */
export const units = new Table({
  code: column.text,
  name: column.text,
  symbol: column.text,
  dimension: column.text,
  factor_to_reference: column.real,
  decimal_scale: column.integer,
  is_active: column.integer, // 1 or 0
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Mã phân loại / Mã quản lý kho (SKUs)
 */
export const skus = new Table({
  product_id: column.text,
  price: column.real,
  images: column.text,
  min_stock: column.integer,
  is_default: column.integer,
  sku_code: column.text,
  sku_status: column.text,
  base_unit_id: column.text,
  tracking_policy: column.text,
  inventory_policy: column.text,
  allow_fraction: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Đơn vị giao dịch quy đổi của từng SKU (SKU Transaction Units)
 */
export const sku_transaction_units = new Table({
  sku_id: column.text,
  unit_id: column.text,
  code: column.text,
  display_name: column.text,
  factor_to_base: column.real,
  allow_receipt: column.integer,
  allow_issue: column.integer,
  allow_fraction: column.integer,
  is_base: column.integer,
  is_active: column.integer,
  legacy_parent_sku_id: column.text,
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Khu vực / Dãy chuồng trại (Zones)
 */
export const zones = new Table({
  name: column.text,
  description: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

/**
 * Ô chuồng / Khu vực phụ (Sub Zones)
 */
export const sub_zones = new Table({
  zone_id: column.text,
  name: column.text,
  description: column.text,
  display_order: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

/**
 * Xe cơ giới và máy móc nông trại (Vehicles)
 */
export const vehicles = new Table({
  code: column.text,
  name: column.text,
  type: column.text,
  zone_id: column.text,
  sub_zone_id: column.text,
  default_driver: column.text,
  fuel_type_id: column.text,
  current_odo: column.real,
  odo_unit: column.text,
  fuel_norm: column.real,
  qr_token: column.text,
  notes: column.text,
  is_active: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Loại nhiên liệu (Fuel Types)
 */
export const fuel_types = new Table({
  code: column.text,
  name: column.text,
  unit: column.text,
  current_stock: column.real,
  min_stock: column.real,
  description: column.text,
  is_active: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Phiếu yêu cầu cấp phát vật tư (Requisitions)
 */
export const requisitions = new Table({
  code: column.text,
  requester_id: column.text,
  zone_id: column.text,
  sub_zone_id: column.text,
  purpose: column.text,
  requisition_type: column.text,
  linked_defect_id: column.text,
  status: column.text,
  approved_by: column.text,
  approved_at: column.text,
  rejection_reason: column.text,
  fulfilled_by: column.text,
  fulfilled_at: column.text,
  fulfillment_notes: column.text,
  received_by: column.text,
  received_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Chi tiết phiếu yêu cầu vật tư (Requisition Items)
 */
export const requisition_items = new Table({
  requisition_id: column.text,
  sku_id: column.text,
  quantity: column.real,
  transaction_unit_id: column.text,
  entered_quantity: column.real,
  conversion_factor_snapshot: column.real,
  sku_name_snapshot: column.text,
  uom_name_snapshot: column.text,
  snapshot_quality: column.text,
  created_at: column.text,
});

/**
 * Nhật ký cấp phát xăng dầu cho xe cơ giới (Fuel Dispenses)
 */
export const fuel_dispenses = new Table({
  code: column.text,
  vehicle_id: column.text,
  zone_id: column.text,
  sub_zone_id: column.text,
  fuel_type_id: column.text,
  quantity: column.real,
  previous_odo: column.real,
  current_odo: column.real,
  usage_diff: column.real,
  consumption_rate: column.real,
  driver_name: column.text,
  dispenser_id: column.text,
  meter_images: column.text,
  notes: column.text,
  status: column.text,
  dispense_type: column.text,
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Sổ mượn / trả công cụ dụng cụ (Tool Borrowings)
 */
export const tool_borrowings = new Table({
  code: column.text,
  borrower_id: column.text,
  zone_id: column.text,
  sub_zone_id: column.text,
  purpose: column.text,
  borrowed_at: column.text,
  expected_return_date: column.text,
  returned_at: column.text,
  issued_by: column.text,
  received_back_by: column.text,
  notes: column.text,
  status: column.text,
  created_at: column.text,
  updated_at: column.text,
});

/**
 * Chi tiết công cụ mượn (Tool Borrowing Items)
 */
export const tool_borrowing_items = new Table({
  borrowing_id: column.text,
  sku_id: column.text,
  quantity: column.real,
  returned_quantity: column.integer,
  notes: column.text,
  transaction_unit_id: column.text,
  entered_quantity: column.real,
  conversion_factor_snapshot: column.real,
  snapshot_quality: column.text,
});

/**
 * Toàn bộ AppSchema của Minh Tân Phát Supply cho PowerSync SQLite
 */
export const AppSchema = new Schema({
  categories,
  products,
  units,
  skus,
  sku_transaction_units,
  zones,
  sub_zones,
  vehicles,
  fuel_types,
  requisitions,
  requisition_items,
  fuel_dispenses,
  tool_borrowings,
  tool_borrowing_items,
});

export type Database = (typeof AppSchema)["types"];
