"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const liquidationSchema = z.object({
  reason: z.string().optional().default(""),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive(),
        method: z.enum(["sale", "dispose"]),
        unitValue: z.number().nonnegative(),
      }),
    )
    .min(1),
});

export async function createLiquidation(input: z.infer<typeof liquidationSchema>) {
  const profile = await requireProfile();
  const parsed = liquidationSchema.parse(input);
  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    variant_id: i.variantId,
    quantity: i.quantity,
    method: i.method,
    unit_value: i.unitValue,
  }));
  const { data, error } = await supabase.rpc("create_liquidation", {
    p_items: items,
    p_reason: parsed.reason,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/liquidations");
  return data as string;
}

export async function approveLiquidation(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_liquidation", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/liquidations");
}

export async function cancelLiquidation(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_liquidation", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/liquidations");
}

export async function rejectLiquidation(id: string, reason: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_liquidation", { p_id: id, p_by: profile.id, p_reason: reason });
  if (error) throw new Error(error.message);
  revalidatePath("/liquidations");
}

export async function completeLiquidation(id: string, outcomes: { itemId: string; proceeds: number }[]) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_liquidation", {
    p_id: id,
    p_items_outcome: outcomes.map((o) => ({ item_id: o.itemId, proceeds: o.proceeds })),
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/liquidations");
  revalidatePath("/products");
}
