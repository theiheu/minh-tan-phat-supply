"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function transferStock(input: {
  items: { variantId: string; quantity: number }[];
  fromLocationId: string;
  toLocationId: string;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_stock", {
    p_items: input.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_from_loc: input.fromLocationId,
    p_to_loc: input.toLocationId,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/transfers");
  revalidatePath("/products");
}

export async function adjustStock(input: {
  variantId: string;
  locationId: string;
  delta: number;
  reason: string;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_variant_id: input.variantId,
    p_location_id: input.locationId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/transfers");
  revalidatePath("/products");
}
