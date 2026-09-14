"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getManagerIds, notifyUsers } from "@/lib/notifications";

async function repairMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("repair_orders")
      .select("code, vendor, expected_return_at, notes, total_cost")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
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
  if (repairId) {
    const meta = await repairMeta(repairId);
    if (meta?.code) code = meta.code;
  }

  await notifyUsers({
    userIds: await getManagerIds(supabase),
    type: "repair",
    title: `[Sửa chữa vật tư] ${code} - Đã gửi vật tư đi sửa chữa`,
    body: `Đã bàn giao ${input.defectItemIds.length} vật tư cho đơn vị sửa chữa: ${input.vendor}.${input.expectedReturnAt ? ` Dự kiến hoàn thành: ${input.expectedReturnAt}` : ""}`,
    link: "/repairs",
    document: {
      code,
      type: "Lệnh sửa chữa vật tư",
      status: "Đang sửa chữa",
      statusVariant: "warning",
      creatorName: profile.name,
      locationName: input.vendor,
      expectedDate: input.expectedReturnAt,
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

  await notifyUsers({
    userIds: await getManagerIds(supabase),
    type: "repair",
    title: `[Sửa chữa vật tư] ${code} - Hoàn tất nghiệm thu sửa chữa`,
    body: `Thủ kho ${profile.name} đã hoàn tất nghiệm thu ${outcomes.length} vật tư sửa chữa và cập nhật sổ kho.`,
    link: "/repairs",
    document: {
      code,
      type: "Lệnh sửa chữa vật tư",
      status: "Đã hoàn tất",
      statusVariant: "success",
      handlerName: profile.name,
      locationName: meta?.vendor,
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

  await notifyUsers({
    userIds: await getManagerIds(supabase),
    type: "repair",
    title: `[Sửa chữa vật tư] ${code} - Đã hủy lệnh sửa chữa`,
    body: `Lệnh sửa chữa vật tư đã được hủy bỏ trên hệ thống bởi ${profile.name}.`,
    link: "/repairs",
    document: {
      code,
      type: "Lệnh sửa chữa vật tư",
      status: "Đã hủy",
      statusVariant: "neutral",
      handlerName: profile.name,
    },
  });

  revalidatePath("/repairs");
  revalidatePath("/defects");
}