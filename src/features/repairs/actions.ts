"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchBusinessEvent } from "@/features/notifications/server/dispatch-business-event";

async function repairMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("repair_orders")
      .select(`
        code,
        vendor,
        expected_return_at,
        notes,
        total_cost,
        items:repair_order_items(
          quantity,
          repair_detail,
          skus(
            products(name),
            units(name, symbol)
          )
        )
      `)
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

function formatRepairItems(items?: any[] | null) {
  if (!items || items.length === 0) return undefined;
  return items.map((i) => ({
    name: i.skus?.products?.name || "Thiết bị",
    quantity: i.quantity,
    unit: i.skus?.units?.name || i.skus?.units?.symbol || "",
    note: i.repair_detail || undefined,
  }));
}

export async function sendToRepair(input: {
  defectItemIds: string[];
  vendor: string;
  sentAt: string | null;
  expectedReturnAt: string | null;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_to_repair", {
    p_defect_item_ids: input.defectItemIds,
    p_vendor: input.vendor,
    // date arg nhận null; generated type chỉ báo string.
    p_sent_at: input.sentAt as string,
    p_expected_return_at: input.expectedReturnAt as string,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  const repairId = data as string;
  let code = "PSC";
  let meta: Awaited<ReturnType<typeof repairMeta>> = null;
  if (repairId) {
    meta = await repairMeta(repairId);
    if (meta?.code) code = meta.code;
  }

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "repair.sent",
      actorId: profile.id,
      subject: { type: "repair", id: repairId },
      payload: {
        code,
        vendorName: input.vendor,
        items: formatRepairItems((meta as any)?.items),
        notes: input.expectedReturnAt ? `Dự kiến: ${input.expectedReturnAt}` : undefined,
      },
    },
  });

  revalidatePath("/defects");
  revalidatePath("/repairs");
  return data as string;
}

export async function completeRepair(input: {
  repairId: string;
  outcomes: { repairItemId: string; outcome: "returned_to_stock" | "liquidation"; cost: number | null }[];
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const outcomes = input.outcomes.map((o) => ({
    repair_item_id: o.repairItemId,
    outcome: o.outcome,
    cost: o.cost,
  }));

  const meta = await repairMeta(input.repairId);
  const code = meta?.code ?? "PSC";

  const { error } = await supabase.rpc("complete_repair", {
    p_repair_id: input.repairId,
    p_outcomes: outcomes,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "repair.accepted_and_returned",
      actorId: profile.id,
      subject: { type: "repair", id: input.repairId },
      payload: {
        code,
        vendorName: meta?.vendor ?? "N/A",
        cost: meta?.total_cost ?? undefined,
        items: formatRepairItems((meta as any)?.items),
        technicianName: profile.name,
      },
    },
  });

  revalidatePath("/repairs");
  revalidatePath("/defects");
  revalidatePath("/products");
}

export async function cancelRepair(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const meta = await repairMeta(id);
  const code = meta?.code ?? "PSC";

  const { error } = await supabase.rpc("cancel_repair", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  try {
    const { data: techUsers } = await supabase.from("profiles").select("id").in("role", ["technician", "warehouse", "owner"]).eq("is_active", true);
    if (techUsers && techUsers.length > 0) {
      await supabase.from("notifications").insert(
        techUsers.map((u) => ({
          user_id: u.id,
          type: "repair",
          title: `[Sửa chữa vật tư] ${code} - Đã hủy lệnh sửa chữa`,
          body: `Lệnh sửa chữa vật tư đã được hủy bỏ trên hệ thống bởi ${profile.name}.`,
          link: "/repairs",
        }))
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[cancelRepair] In-app notification error:", err);
  }

  revalidatePath("/repairs");
  revalidatePath("/defects");
}