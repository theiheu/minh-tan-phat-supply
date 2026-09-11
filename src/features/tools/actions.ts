"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/notifications";
import {
  toolBorrowingSchema,
  toolReturnSchema,
  type ToolBorrowingInput,
  type ToolReturnInput,
} from "./schema";

export async function createToolBorrowing(input: ToolBorrowingInput) {
  const profile = await requireProfile();
  const parsed = toolBorrowingSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_tool_borrowing", {
    p_items: parsed.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_zone_id: (parsed.zoneId ?? null) as unknown as string,
    p_purpose: parsed.purpose.trim(),
    p_expected_return_date: (parsed.expectedReturnDate ?? null) as unknown as string,
    p_borrower_id: parsed.borrowerId || profile.id,
    p_sub_zone_id: (parsed.subZoneId ?? null) as unknown as string,
  });

  if (error) throw new Error(error.message);

  const borrowerId = parsed.borrowerId || profile.id;
  await notifyUsers({
    userIds: [borrowerId],
    type: "tool_borrowing",
    title: "Xác nhận mượn dụng cụ",
    body: `Mục đích: ${parsed.purpose.trim()}${parsed.expectedReturnDate ? ` (Hạn trả: ${parsed.expectedReturnDate})` : ""}`,
    link: "/tools",
  });

  revalidatePath("/tools");
  revalidatePath("/products");
  return data as string;
}

export async function returnToolBorrowing(input: ToolReturnInput) {
  const profile = await requireManager();
  const parsed = toolReturnSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.rpc("return_tool_borrowing", {
    p_borrowing_id: parsed.borrowingId,
    p_items: parsed.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_notes: parsed.notes || "",
    p_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/tools");
  revalidatePath("/products");
}

export async function cancelToolBorrowing(borrowingId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_tool_borrowing", {
    p_borrowing_id: borrowingId,
    p_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/tools");
  revalidatePath("/products");
}
