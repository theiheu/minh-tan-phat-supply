import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE_ROLE_KEY);

async function testInsertBase() {
  // Test unit insertion
  const { data: u, error: uErr } = await admin.from("units").insert({
    code: "CAI",
    name: "Cái",
    symbol: "cái",
    dimension: "count",
    factor_to_reference: 1,
    decimal_scale: 0,
    is_active: true
  }).select("id").single();
  console.log("unit insert:", uErr?.message || "OK", u?.id);

  // Test category
  const { data: cat } = await admin.from("categories").select("id").limit(1).single();

  // Test product
  const { data: p, error: pErr } = await admin.from("products").insert({
    name: "Quạt thông gió vuông công nghiệp",
    category_id: cat?.id,
    catalog_status: "active",
    description: "Quạt hút trang trại 1380x1380",
    images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"]
  }).select("id").single();
  console.log("product insert:", pErr?.message || "OK", p?.id);

  // Test attr def
  const { data: attrDef, error: aErr } = await admin.from("attribute_definitions").insert({
    name: "Công suất",
    data_type: "text"
  }).select("id").single();
  console.log("attrDef insert:", aErr?.message || "OK", attrDef?.id);

  // Test sku
  const { data: sku, error: sErr } = await admin.from("skus").insert({
    product_id: p?.id,
    sku_code: "SKU-TEST-001",
    unit_id: u?.id,
    price: 1500000,
    min_stock: 5,
    inventory_policy: "normal",
    tracking_policy: "none",
    sku_status: "active",
    is_default: true,
    images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"]
  }).select("id").single();
  console.log("sku insert:", sErr?.message || "OK", sku?.id);

  // Test sku transaction unit
  const { data: tu, error: tuErr } = await admin.from("sku_transaction_units").insert({
    sku_id: sku?.id,
    unit_id: u?.id,
    code: "CAI",
    display_name: "Cái",
    factor_to_base: 1,
    is_base: true,
    allow_receipt: true,
    allow_issue: true,
    allow_fraction: false
  }).select("id").single();
  console.log("sku_transaction_units insert:", tuErr?.message || "OK", tu?.id);

  // Clean test data
  if (sku?.id) {
    await admin.from("sku_transaction_units").delete().eq("sku_id", sku.id);
    await admin.from("skus").delete().eq("id", sku.id);
  }
  if (p?.id) await admin.from("products").delete().eq("id", p.id);
  if (attrDef?.id) await admin.from("attribute_definitions").delete().eq("id", attrDef.id);
  if (u?.id) await admin.from("units").delete().eq("id", u.id);
}
testInsertBase();
