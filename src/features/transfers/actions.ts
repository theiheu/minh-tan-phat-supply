"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getManagerIds, notifyUsers } from "@/lib/notifications";
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

  await notifyUsers({
    userIds: await getManagerIds(supabase),
    type: "transfer",
    title: "[Điều chuyển kho] - Đã hoàn tất điều chuyển kho nội bộ",
    body: `Thủ kho ${profile.name} đã hoàn tất điều chuyển ${input.items.length} mặt hàng vật tư giữa các vị trí kho.`,
    link: "/transfers",
    document: {
      type: "Phiếu điều chuyển kho",
      status: "Đã hoàn tất",
      statusVariant: "success",
      handlerName: profile.name,
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

  await notifyUsers({
    userIds: await getManagerIds(supabase),
    type: "transfer",
    title: "[Điều chỉnh kho] - Đã ghi nhận điều chỉnh tồn kho",
    body: `Thủ kho ${profile.name} đã điều chỉnh tồn kho (Chênh lệch: ${input.delta > 0 ? `+${input.delta}` : input.delta}). Lý do: ${input.reason}`,
    link: "/transfers",
    document: {
      type: "Phiếu điều chỉnh tồn kho",
      status: "Đã điều chỉnh",
      statusVariant: "info",
      handlerName: profile.name,
      notes: input.reason,
    },
  });

  revalidatePath("/transfers");
  revalidatePath("/products");
}