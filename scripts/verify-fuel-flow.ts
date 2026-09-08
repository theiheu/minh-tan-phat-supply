import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.log("No service role key in env, skipping standalone script check.");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log("1. Checking fuel_types...");
  const { data: fuelTypes, error: ftError } = await supabase.from("fuel_types").select("*");
  if (ftError) throw ftError;
  console.log(`✓ Found ${fuelTypes.length} fuel types:`, fuelTypes.map((f) => f.code));

  console.log("2. Checking vehicles...");
  const { data: vehicles, error: vError } = await supabase.from("vehicles").select("*");
  if (vError) throw vError;
  console.log(`✓ Found ${vehicles.length} vehicles:`, vehicles.map((v) => v.code));

  console.log("3. Testing get_vehicle_by_qr RPC...");
  const { data: qrRes, error: qrErr } = await supabase.rpc("get_vehicle_by_qr", {
    p_qr_text: "61C-123.45",
  });
  if (qrErr) throw qrErr;
  console.log("✓ QR lookup result:", qrRes);

  console.log("All DB checks passed successfully!");
}

main().catch((err) => {
  console.error("Error verifying fuel flow:", err);
  process.exit(1);
});
