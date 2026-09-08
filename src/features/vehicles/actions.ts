"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { vehicleSchema, type VehicleInput } from "./schema";
import { generateVehicleQrToken } from "@/lib/fuel";

export async function getVehicles(opts?: { activeOnly?: boolean }) {
  const supabase = await createClient();
  let query = supabase
    .from("vehicles")
    .select("*, zone:zones(name), fuel_type:fuel_types(name,code)")
    .order("code");
  if (opts?.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getVehicleById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, zone:zones(name), fuel_type:fuel_types(name,code)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createVehicleAction(input: VehicleInput) {
  await requireManager();
  const parsed = vehicleSchema.parse(input);

  const supabase = await createClient();
  const qrToken = generateVehicleQrToken(parsed.code);

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      code: parsed.code,
      name: parsed.name,
      type: parsed.type,
      zone_id: parsed.zoneId ?? null,
      default_driver: parsed.defaultDriver ?? null,
      fuel_type_id: parsed.fuelTypeId ?? null,
      current_odo: parsed.currentOdo,
      odo_unit: parsed.odoUnit,
      fuel_norm: parsed.fuelNorm ?? null,
      qr_token: qrToken,
      notes: parsed.notes ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehicles");
  return data.id;
}

export async function updateVehicleAction(id: string, input: VehicleInput) {
  await requireManager();
  const parsed = vehicleSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicles")
    .update({
      code: parsed.code,
      name: parsed.name,
      type: parsed.type,
      zone_id: parsed.zoneId ?? null,
      default_driver: parsed.defaultDriver ?? null,
      fuel_type_id: parsed.fuelTypeId ?? null,
      current_odo: parsed.currentOdo,
      odo_unit: parsed.odoUnit,
      fuel_norm: parsed.fuelNorm ?? null,
      notes: parsed.notes ?? null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehicles");
}

export async function toggleVehicleActiveAction(id: string, isActive: boolean) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicles")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/vehicles");
}
