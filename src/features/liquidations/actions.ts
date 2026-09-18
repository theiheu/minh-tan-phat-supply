"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getManagerIds, notifyUsers } from "@/lib/notifications";

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

async function liquidationMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("liquidation_notes")
      .select("code, created_by, reason")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function createLiquidation(input: z.infer<typeof liquidationSchema>) {
  const profile = await requireProfile();
  const parsed = liquidationSchema.parse(input);
  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    sku_id: i.variantId,
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

  const liquidationId = data as string;
  let code = "PTL";
  if (liquidationId) {
    const meta = await liquidationMeta(liquidationId);
    if (meta?.code) code = meta.code;
  }

  await notifyUsers({
    userIds: await getManagerIds(supabase),
    type: "liquidation",
    title: `[Thanh lý vật tư] ${code} - Chờ phê duyệt thanh lý`,
    body: `Người lập ${profile.name} đã tạo phiếu đề xuất thanh lý ${items.length} mặt hàng vật tư.${parsed.reason ? ` Lý do: ${parsed.reason}` : ""}`,
    link: "/liquidations",
    document: {
      code,
      type: "Phiếu thanh lý vật tư",
      status: "Chờ phê duyệt",
      statusVariant: "warning",
      creatorName: profile.name,
      notes: parsed.reason,
    },
  });

  revalidatePath("/liquidations");
  return data as string;
}

export async function approveLiquidation(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_liquidation", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await liquidationMeta(id);
  const code = meta?.code ?? "PTL";
  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.created_by, ...managers])];

  await notifyUsers({
    userIds,
    type: "liquidation",
    title: `[Thanh lý vật tư] ${code} - Đã phê duyệt thanh lý`,
    body: `Phiếu thanh lý vật tư đã được phê duyệt bởi ${profile.name}, sẵn sàng tiến hành thanh lý/xử lý.`,
    link: "/liquidations",
    document: {
      code,
      type: "Phiếu thanh lý vật tư",
      status: "Đã phê duyệt",
      statusVariant: "success",
      handlerName: profile.name,
    },
  });

  revalidatePath("/liquidations");
}

export async function cancelLiquidation(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const meta = await liquidationMeta(id);
  const code = meta?.code ?? "PTL";

  const { error } = await supabase.rpc("cancel_liquidation", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.created_by, ...managers])];

  await notifyUsers({
    userIds,
    type: "liquidation",
    title: `[Thanh lý vật tư] ${code} - Đã hủy phiếu thanh lý`,
    body: `Phiếu thanh lý vật tư đã được hủy bỏ trên hệ thống bởi ${profile.name}.`,
    link: "/liquidations",
    document: {
      code,
      type: "Phiếu thanh lý vật tư",
      status: "Đã hủy",
      statusVariant: "neutral",
      handlerName: profile.name,
    },
  });

  revalidatePath("/liquidations");
}

export async function rejectLiquidation(id: string, reason: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const meta = await liquidationMeta(id);
  const code = meta?.code ?? "PTL";

  const { error } = await supabase.rpc("reject_liquidation", { p_id: id, p_by: profile.id, p_reason: reason });
  if (error) throw new Error(error.message);

  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.created_by, ...managers])];

  await notifyUsers({
    userIds,
    type: "liquidation",
    title: `[Thanh lý vật tư] ${code} - Bị từ chối thanh lý`,
    body: `Phiếu thanh lý vật tư bị từ chối phê duyệt bởi ${profile.name}.${reason ? ` Lý do: ${reason}` : ""}`,
    link: "/liquidations",
    document: {
      code,
      type: "Phiếu thanh lý vật tư",
      status: "Bị từ chối",
      statusVariant: "danger",
      handlerName: profile.name,
      notes: reason,
    },
  });

  revalidatePath("/liquidations");
}

export async function completeLiquidation(id: string, outcomes: { itemId: string; proceeds: number }[]) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const meta = await liquidationMeta(id);
  const code = meta?.code ?? "PTL";

  const { error } = await supabase.rpc("complete_liquidation", {
    p_id: id,
    p_items_outcome: outcomes.map((o) => ({ item_id: o.itemId, proceeds: o.proceeds })),
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.created_by, ...managers])];

  await notifyUsers({
    userIds,
    type: "liquidation",
    title: `[Thanh lý vật tư] ${code} - Đã hoàn tất thanh lý vật tư`,
    body: `Thủ kho ${profile.name} đã hoàn tất thủ tục thanh lý và ghi nhận kết quả vào hệ thống MTP-ERN.`,
    link: "/liquidations",
    document: {
      code,
      type: "Phiếu thanh lý vật tư",
      status: "Đã hoàn tất",
      statusVariant: "success",
      handlerName: profile.name,
    },
  });

  revalidatePath("/liquidations");
  revalidatePath("/products");
}