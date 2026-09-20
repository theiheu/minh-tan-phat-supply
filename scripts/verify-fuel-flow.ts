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

  const testVehicle = vehicles[0];
  if (!testVehicle) throw new Error("No vehicle found to test");

  console.log("3. Testing get_vehicle_by_qr RPC with vehicle code:", testVehicle.code);
  const { data: qrRes, error: qrErr } = await supabase.rpc("get_vehicle_by_qr", {
    p_qr_text: testVehicle.qr_token || testVehicle.code,
  });
  if (qrErr) throw qrErr;
  console.log("✓ QR lookup result:", qrRes);

  const { data: adminProfile } = await supabase.from("profiles").select("id").limit(1).single();
  const { data: testZone } = await supabase.from("zones").select("id").limit(1).single();

  if (adminProfile && testZone) {
    console.log("Ensuring stock for fuel type...");
    await supabase.rpc("create_fuel_receipt", {
      p_supplier_id: null,
      p_fuel_type_id: fuelTypes[0].id,
      p_quantity: 1000,
      p_unit_price: 20000,
      p_invoice_number: "TEST-INV-01",
      p_invoice_images: [],
      p_notes: "Seed stock for test",
      p_by: adminProfile.id,
    });

    console.log("4. Testing create_fuel_dispense for ZONE (Cấp cho toàn khu)...");
    const { data: zoneDispenseId, error: zdErr } = await supabase.rpc("create_fuel_dispense", {
      p_vehicle_id: testVehicle.id,
      p_zone_id: testZone.id,
      p_fuel_type_id: fuelTypes[0].id,
      p_quantity: 50,
      p_current_odo: null,
      p_driver_name: "Tài xế Test",
      p_meter_images: [],
      p_notes: "Test cấp dầu cho toàn khu",
      p_by: adminProfile.id,
      p_sub_zone_id: null,
      p_driver_id: null,
      p_dispense_type: "zone",
    });
    if (zdErr) throw zdErr;
    console.log("✓ Created zone dispense id:", zoneDispenseId);

    const { data: zdRow } = await supabase.from("fuel_dispenses").select("*").eq("id", zoneDispenseId).single();
    console.log("✓ Zone dispense row:", {
      code: zdRow.code,
      dispense_type: zdRow.dispense_type,
      vehicle_id: zdRow.vehicle_id,
      zone_id: zdRow.zone_id,
      usage_diff: zdRow.usage_diff,
      consumption_rate: zdRow.consumption_rate,
      current_odo: zdRow.current_odo,
    });

    if (zdRow.dispense_type !== "zone") throw new Error("Expected dispense_type to be 'zone'");
    if (zdRow.consumption_rate !== null) throw new Error("Expected consumption_rate to be null for zone dispense");
    if (zdRow.usage_diff !== null) throw new Error("Expected usage_diff to be null for zone dispense");
    if (zdRow.vehicle_id !== testVehicle.id) throw new Error("Expected vehicle_id to record the pickup vehicle");

    console.log("5. Testing create_fuel_dispense for VEHICLE (Cấp cho xe)...");
    const newOdo = (Number(testVehicle.current_odo) || 0) + 50;
    const { data: vehDispenseId, error: vdErr } = await supabase.rpc("create_fuel_dispense", {
      p_vehicle_id: testVehicle.id,
      p_zone_id: testVehicle.zone_id || testZone.id,
      p_fuel_type_id: fuelTypes[0].id,
      p_quantity: 20,
      p_current_odo: newOdo,
      p_driver_name: "Tài xế Test",
      p_meter_images: [],
      p_notes: "Test cấp dầu cho xe",
      p_by: adminProfile.id,
      p_sub_zone_id: null,
      p_driver_id: null,
      p_dispense_type: "vehicle",
    });
    if (vdErr) throw vdErr;
    console.log("✓ Created vehicle dispense id:", vehDispenseId);

    const { data: vdRow } = await supabase.from("fuel_dispenses").select("*").eq("id", vehDispenseId).single();
    console.log("✓ Vehicle dispense row:", {
      code: vdRow.code,
      dispense_type: vdRow.dispense_type,
      vehicle_id: vdRow.vehicle_id,
      zone_id: vdRow.zone_id,
      usage_diff: vdRow.usage_diff,
      consumption_rate: vdRow.consumption_rate,
      current_odo: vdRow.current_odo,
    });

    if (vdRow.dispense_type !== "vehicle") throw new Error("Expected dispense_type to be 'vehicle'");
    if (Number(vdRow.current_odo) !== newOdo) throw new Error("Expected current_odo to match newOdo");
  }

  console.log("All DB checks passed successfully!");
}

main().catch((err) => {
  console.error("Error verifying fuel flow:", err);
  process.exit(1);
});
