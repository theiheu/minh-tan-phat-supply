"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { defectSchema, type DefectInput } from "./schema";

export async function recordDefect(input: DefectInput) {
  const profile = await requireProfile();
  const parsed = defectSchema.parse(input);

  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    variant_id: i.variantId,
    quantity: i.quantity,
    damage_detail: i.damageDetail,
    damage_type: null,
    severity: null,
    images: i.images,
    note: i.note ?? "",
  }));

  const { data, error } = await supabase.rpc("record_defect", {
    p_items: items,
    p_source_loc: parsed.sourceLocationId,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/defects");
  revalidatePath("/products");
  return data as string;
}

export async function cancelDefect(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_defect", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/defects");
}

export async function requestRepair(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_repair", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/defects");
}

export async function cancelRepairRequest(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_repair_request", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/defects");
}
