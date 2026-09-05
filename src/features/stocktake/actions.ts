"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createStocktake(locationId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_stocktake", {
    p_location_id: locationId,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/stocktake");
  return data as string;
}

export async function postStocktake(sessionId: string, items: { itemId: string; actualQty: number }[]) {
  const profile = await requireProfile();
  const supabase = await createClient();
  for (const it of items) {
    const { error } = await supabase.from("stocktake_items").update({ actual_qty: it.actualQty }).eq("id", it.itemId);
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.rpc("post_stocktake", { p_session_id: sessionId, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/stocktake");
  revalidatePath("/products");
}
