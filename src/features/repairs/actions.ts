"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.rpc("complete_repair", {
    p_repair_id: input.repairId,
    p_outcomes: outcomes,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/repairs");
  revalidatePath("/defects");
  revalidatePath("/products");
}

export async function cancelRepair(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_repair", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/repairs");
  revalidatePath("/defects");
}
