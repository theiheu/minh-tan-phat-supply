import { describe, it, expect } from "vitest";
import {
  AppSchema,
  categories,
  products,
  skus,
  units,
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
} from "./schema";

describe("PowerSync AppSchema", () => {
  it("defines all required tables for offline synchronization", () => {
    expect(AppSchema.tables).toBeDefined();
    
    // Check tables exist in schema
    expect(categories).toBeDefined();
    expect(products).toBeDefined();
    expect(skus).toBeDefined();
    expect(units).toBeDefined();
    expect(sku_transaction_units).toBeDefined();
    expect(zones).toBeDefined();
    expect(sub_zones).toBeDefined();
    expect(vehicles).toBeDefined();
    expect(fuel_types).toBeDefined();
    expect(requisitions).toBeDefined();
    expect(requisition_items).toBeDefined();
    expect(fuel_dispenses).toBeDefined();
    expect(tool_borrowings).toBeDefined();
    expect(tool_borrowing_items).toBeDefined();
  });

  it("contains proper column definitions for skus table", () => {
    const columns = skus.columns;
    expect(columns).toBeDefined();
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain("product_id");
    expect(columnNames).toContain("sku_code");
    expect(columnNames).toContain("base_unit_id");
    expect(columnNames).toContain("price");
  });

  it("contains proper column definitions for requisitions table", () => {
    const columns = requisitions.columns;
    expect(columns).toBeDefined();
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain("code");
    expect(columnNames).toContain("requester_id");
    expect(columnNames).toContain("zone_id");
    expect(columnNames).toContain("purpose");
    expect(columnNames).toContain("status");
  });
});
