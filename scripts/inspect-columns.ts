import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE_ROLE_KEY);

async function inspectTables() {
  // Let's test insert / select on key tables to see column requirements
  const { data: pData, error: pErr } = await admin.from("products").select("*").limit(1);
  console.log("products columns test:", pErr?.message, pData);

  const { data: sData, error: sErr } = await admin.from("skus").select("*").limit(1);
  console.log("skus columns test:", sErr?.message, sData);

  const { data: uData, error: uErr } = await admin.from("units").select("*").limit(1);
  console.log("units columns test:", uErr?.message, uData);

  const { data: tuData, error: tuErr } = await admin.from("sku_transaction_units").select("*").limit(1);
  console.log("sku_transaction_units columns test:", tuErr?.message, tuData);

  const { data: vData, error: vErr } = await admin.from("vehicles").select("*").limit(1);
  console.log("vehicles columns test:", vErr?.message, vData);

  const { data: fData, error: fErr } = await admin.from("fuel_types").select("*").limit(1);
  console.log("fuel_types columns test:", fErr?.message, fData);

  const { data: tbData, error: tbErr } = await admin.from("tool_borrowings").select("*").limit(1);
  console.log("tool_borrowings columns test:", tbErr?.message, tbData);

  const { data: tbiData, error: tbiErr } = await admin.from("tool_borrowing_items").select("*").limit(1);
  console.log("tool_borrowing_items columns test:", tbiErr?.message, tbiData);

  const { data: reqData, error: reqErr } = await admin.from("requisitions").select("*").limit(1);
  console.log("requisitions columns test:", reqErr?.message, reqData);

  const { data: issData, error: issErr } = await admin.from("issues").select("*").limit(1);
  console.log("issues columns test:", issErr?.message, issData);

  const { data: recData, error: recErr } = await admin.from("receipts").select("*").limit(1);
  console.log("receipts columns test:", recErr?.message, recData);

  const { data: stkData, error: stkErr } = await admin.from("stocktakes").select("*").limit(1);
  console.log("stocktakes columns test:", stkErr?.message, stkData);
}
inspectTables();
