"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchBusinessEvent } from "@/features/notifications/server/dispatch-business-event";

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
      .select(`
        code,
        created_by,
        reason,
        items:liquidation_items(
          quantity,
          entered_quantity,
          method,
          proceeds,
          unit_value,
          sku_name_snapshot,
          uom_name_snapshot
        )
      `)
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

function formatLiquidationItems(items?: any[] | null) {
  if (!items || items.length === 0) return undefined;
  return items.map((i) => ({
    name: i.sku_name_snapshot || "Vật tư thanh lý",
    quantity: i.entered_quantity ?? i.quantity,
    unit: i.uom_name_snapshot || "",
    note: i.method === "sale" ? "Thanh lý bán" : "Hủy bỏ",
  }));
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

  const meta = liquidationId ? await liquidationMeta(liquidationId) : null;
  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "liquidation.created",
      actorId: profile.id,
      subject: { type: "liquidation", id: liquidationId },
      payload: {
        code,
        itemCount: items.length,
        reason: parsed.reason,
        handlerName: profile.name,
        items: formatLiquidationItems((meta as any)?.items),
      },
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
  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "liquidation.approved",
      actorId: profile.id,
      subject: { type: "liquidation", id },
      payload: {
        code,
        itemCount: (meta as any)?.items?.length ?? 1,
        items: formatLiquidationItems((meta as any)?.items),
        handlerName: profile.name,
      },
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

  try {
    const userIds = [...new Set([meta?.created_by].filter(Boolean))];
    if (userIds.length > 0) {
      await supabase.from("notifications").insert(
        userIds.map((uid) => ({
          user_id: uid!,
          type: "liquidation",
          title: `[Thanh lý vật tư] ${code} - Đã hủy phiếu thanh lý`,
          body: `Phiếu thanh lý vật tư đã được hủy bỏ bởi ${profile.name}.`,
          link: "/liquidations",
        }))
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[cancelLiquidation] In-app notification error:", err);
  }

  revalidatePath("/liquidations");
}

export async function rejectLiquidation(id: string, reason: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const meta = await liquidationMeta(id);
  const code = meta?.code ?? "PTL";

  const { error } = await supabase.rpc("reject_liquidation", { p_id: id, p_by: profile.id, p_reason: reason });
  if (error) throw new Error(error.message);

  try {
    const userIds = [...new Set([meta?.created_by].filter(Boolean))];
    if (userIds.length > 0) {
      await supabase.from("notifications").insert(
        userIds.map((uid) => ({
          user_id: uid!,
          type: "liquidation",
          title: `[Thanh lý vật tư] ${code} - Bị từ chối thanh lý`,
          body: `Phiếu thanh lý vật tư bị từ chối bởi ${profile.name}.${reason ? ` Lý do: ${reason}` : ""}`,
          link: "/liquidations",
        }))
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[rejectLiquidation] In-app notification error:", err);
  }

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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "liquidation.completed",
      actorId: profile.id,
      subject: { type: "liquidation", id },
      payload: {
        code,
        itemCount: outcomes.length,
        items: formatLiquidationItems((meta as any)?.items),
        handlerName: profile.name,
      },
    },
  });

  revalidatePath("/liquidations");
  revalidatePath("/products");
}