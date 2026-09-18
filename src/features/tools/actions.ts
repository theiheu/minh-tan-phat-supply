"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getManagerIds, notifyUsers } from "@/lib/notifications";
import {
  toolBorrowingSchema,
  toolReturnSchema,
  type ToolBorrowingInput,
  type ToolReturnInput,
} from "./schema";

async function toolMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("tool_borrowings")
      .select("code, borrower_id, purpose, expected_return_date, zone:zones(name)")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function createToolBorrowing(input: ToolBorrowingInput) {
  const profile = await requireProfile();
  const parsed = toolBorrowingSchema.parse(input);
  const supabase = await createClient();

  const borrowerId = parsed.borrowerId || profile.id;

  const { data, error } = await supabase.rpc("create_tool_borrowing", {
    p_items: parsed.items.map((i) => ({
      sku_id: i.skuId,
      quantity: i.quantity,
    })),
    p_zone_id: (parsed.zoneId ?? null) as unknown as string,
    p_purpose: parsed.purpose.trim(),
    p_expected_return_date: (parsed.expectedReturnDate ?? null) as unknown as string,
    p_borrower_id: borrowerId,
    p_sub_zone_id: (parsed.subZoneId ?? null) as unknown as string,
  });

  if (error) throw new Error(error.message);

  const borrowingId = data as string;
  let code = "PMDC";
  if (borrowingId) {
    const meta = await toolMeta(borrowingId);
    if (meta?.code) code = meta.code;
  }

  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([borrowerId, ...managers])];

  await notifyUsers({
    userIds,
    type: "tool_borrowing",
    title: `[Mượn CCDC] ${code} - Xác nhận bàn giao mượn dụng cụ`,
    body: `Đã bàn giao công cụ dụng cụ cho nhân sự. Mục đích: ${parsed.purpose.trim()}${parsed.expectedReturnDate ? ` (Hạn trả: ${parsed.expectedReturnDate})` : ""}`,
    link: "/tools",
    document: {
      code,
      type: "Phiếu mượn CCDC",
      status: "Đang mượn",
      statusVariant: "info",
      creatorName: profile.name,
      notes: parsed.purpose.trim(),
      expectedDate: parsed.expectedReturnDate,
    },
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
    p_items: parsed.items.map((i) => ({
      sku_id: i.skuId,
      quantity: i.quantity,
    })),
    p_notes: parsed.notes || "",
    p_by: profile.id,
  });

  if (error) throw new Error(error.message);

  const meta = await toolMeta(parsed.borrowingId);
  const code = meta?.code ?? "PMDC";

  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.borrower_id, ...managers])];

  await notifyUsers({
    userIds,
    type: "tool_borrowing",
    title: `[Trả CCDC] ${code} - Đã hoàn tất thu hồi / trả dụng cụ`,
    body: `Thủ kho ${profile.name} đã ghi nhận thu hồi và nhập lại công cụ dụng cụ vào kho.`,
    link: "/tools",
    document: {
      code,
      type: "Phiếu trả CCDC",
      status: "Đã hoàn tất",
      statusVariant: "success",
      handlerName: profile.name,
      notes: parsed.notes,
    },
  });

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

  const meta = await toolMeta(borrowingId);
  const code = meta?.code ?? "PMDC";

  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.borrower_id, ...managers])];

  await notifyUsers({
    userIds,
    type: "tool_borrowing",
    title: `[Mượn CCDC] ${code} - Đã hủy phiếu mượn dụng cụ`,
    body: `Phiếu mượn công cụ dụng cụ đã được hủy bỏ trên hệ thống bởi ${profile.name}.`,
    link: "/tools",
    document: {
      code,
      type: "Phiếu mượn CCDC",
      status: "Đã hủy",
      statusVariant: "neutral",
      handlerName: profile.name,
    },
  });

  revalidatePath("/tools");
  revalidatePath("/products");
}
