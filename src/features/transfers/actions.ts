"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchBusinessEvent } from "@/features/notifications/server/dispatch-business-event";
import type { Json } from "@/types/database.types";

export async function transferStock(input: {
  items: {
    skuId?: string;
    variantId?: string;
    enteredQuantity?: number;
    quantity?: number;
    transactionUnitId?: string | null;
    allocations?: Record<string, unknown>[];
  }[];
  fromLocationId: string;
  toLocationId: string;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_stock", {
    p_items: input.items.map((i) => ({
      sku_id: i.skuId || i.variantId,
      entered_quantity: i.enteredQuantity ?? i.quantity,
      quantity: i.enteredQuantity ?? i.quantity,
      transaction_unit_id: i.transactionUnitId ?? null,
      allocations: i.allocations ?? null,
    })) as unknown as Json,
    p_from_loc: input.fromLocationId,
    p_to_loc: input.toLocationId,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "transfer.completed",
      actorId: profile.id,
      subject: { type: "transfer", id: crypto.randomUUID() },
      payload: {
        code: "DCK",
        itemCount: input.items.length,
        handlerName: profile.name,
      },
    },
  });

  revalidatePath("/transfers");
  revalidatePath("/products");
}

export async function adjustStock(input: {
  skuId?: string;
  variantId?: string;
  locationId: string;
  delta: number;
  reason: string;
}) {
  const skuId = input.skuId || input.variantId;
  if (!skuId) throw new Error("Chưa chọn vật tư cần điều chỉnh");
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_sku_id: skuId,
    p_location_id: input.locationId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "stock.adjusted",
      actorId: profile.id,
      subject: { type: "transfer", id: skuId },
      payload: {
        code: "ĐCK",
        delta: input.delta,
        reason: input.reason,
        handlerName: profile.name,
      },
    },
  });

  revalidatePath("/transfers");
  revalidatePath("/products");
}
