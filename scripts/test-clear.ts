import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE_ROLE_KEY);

async function testClear() {
  const tables = [
    "notifications",
    "audit_logs",
    "fuel_movements",
    "fuel_dispenses",
    "fuel_receipts",
    "stocktake_items",
    "stocktake_sessions",
    "tool_borrowing_items",
    "tool_borrowings",
    "repair_order_items",
    "repair_orders",
    "exchange_note_items",
    "exchange_notes",
    "defect_note_items",
    "defect_notes",
    "liquidation_items",
    "liquidation_notes",
    "requisition_return_items",
    "requisition_returns",
    "requisition_items",
    "requisitions",
    "issue_items",
    "issues",
    "receipt_items",
    "receipts",
    "stock_reservation_allocations",
    "stock_reservations",
    "inventory_posting_command_movements",
    "inventory_posting_commands",
    "stock_movement_allocations",
    "stock_movements",
    "stock_balances",
    "lot_stock_balances",
    "serial_items",
    "inventory_lots",
    "barcode_registry",
    "bom_items",
    "bom_versions",
    "bom_headers",
    "sku_attribute_values",
    "sku_transaction_units",
    "sku_prices",
    "skus",
    "product_attribute_definitions",
    "products",
    "attribute_option_values",
    "attribute_definitions",
    "vehicles",
    "fuel_types",
    "units",
    "customers",
    "suppliers",
    "sub_zones",
  ];

  for (const t of tables) {
    const { error } = await admin.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error && !error.message.includes("does not exist")) {
      console.log("Delete", t, "error:", error.message);
    } else {
      console.log("Delete", t, "success");
    }
  }
}
testClear().catch(console.error);
