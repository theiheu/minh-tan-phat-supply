import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function check() {
  const { data: units } = await admin.from("units").select("*");
  console.log("UNITS:", units);

  const { data: locations } = await admin.from("stock_locations").select("*");
  console.log("LOCATIONS:", locations);

  const { data: fuelTypes } = await admin.from("fuel_types").select("*");
  console.log("FUEL TYPES:", fuelTypes);

  const { data: vehicles } = await admin.from("vehicles").select("*");
  console.log("VEHICLES:", vehicles);

  const { data: zones } = await admin.from("zones").select("*, sub_zones(*)");
  console.log("ZONES & SUB_ZONES:", JSON.stringify(zones, null, 2));

  const { data: categories } = await admin.from("categories").select("id, name, code");
  console.log("CATEGORIES:", categories);

  const { data: products } = await admin.from("products").select("id, name, code, category_id");
  console.log("PRODUCTS COUNT:", products?.length);

  const { data: skus } = await admin.from("skus").select("id, sku, name, unit_id, inventory_policy, tracking_policy");
  console.log("SKUS COUNT:", skus?.length, "SAMPLE:", skus?.slice(0, 5));

  const { data: bomHeaders } = await admin.from("bom_headers").select("*, bom_items(*)");
  console.log("BOM HEADERS (Assemblies/Virtual Kits):", bomHeaders);
}
check().catch(console.error);
