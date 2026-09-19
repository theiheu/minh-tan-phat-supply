import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function testSelect() {
  const t1 = await admin.from("categories").select("*");
  console.log("categories error/data:", t1.error?.message, t1.data);

  const t2 = await admin.from("products").select("*");
  console.log("products error/data:", t2.error?.message, t2.data?.length);

  const t3 = await admin.from("skus").select("*");
  console.log("skus error/data:", t3.error?.message, t3.data?.length, t3.data?.[0]);

  const t4 = await admin.from("sku_transaction_units").select("*");
  console.log("sku_transaction_units error/data:", t4.error?.message, t4.data?.length, t4.data?.[0]);

  const t5 = await admin.from("vehicles").select("*");
  console.log("vehicles error/data:", t5.error?.message, t5.data);

  const t6 = await admin.from("fuel_types").select("*");
  console.log("fuel_types error/data:", t6.error?.message, t6.data);
}
testSelect();
