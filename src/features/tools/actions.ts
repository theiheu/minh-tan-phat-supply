"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchBusinessEvent } from "@/features/notifications/server/dispatch-business-event";
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
      .select(`
        code,
        borrower_id,
        purpose,
        expected_return_date,
        zone:zones(name),
        items:tool_borrowing_items(
          quantity,
          entered_quantity,
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

function formatToolItems(items?: any[] | null) {
  if (!items || items.length === 0) return undefined;
  return items.map((i) => ({
    name: i.sku_name_snapshot || "Dụng cụ",
    quantity: i.entered_quantity ?? i.quantity,
    unit: i.uom_name_snapshot || "",
  }));
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
  let meta: Awaited<ReturnType<typeof toolMeta>> = null;
  if (borrowingId) {
    meta = await toolMeta(borrowingId);
    if (meta?.code) code = meta.code;
  }

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "tool.borrowed",
      actorId: profile.id,
      subject: { type: "tool_borrowing", id: borrowingId },
      participants: { borrowerId },
      payload: {
        code,
        toolNames: `${parsed.items.length} công cụ dụng cụ`,
        expectedReturnDate: parsed.expectedReturnDate ?? undefined,
        items: formatToolItems((meta as any)?.items),
        handlerName: profile.name,
      },
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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "tool.returned",
      actorId: profile.id,
      subject: { type: "tool_borrowing", id: parsed.borrowingId },
      participants: { borrowerId: meta?.borrower_id },
      payload: {
        code,
        toolNames: "Công cụ dụng cụ",
        items: formatToolItems((meta as any)?.items),
        handlerName: profile.name,
      },
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

  try {
    const userIds = [...new Set([meta?.borrower_id].filter(Boolean))];
    if (userIds.length > 0) {
      await supabase.from("notifications").insert(
        userIds.map((uid) => ({
          user_id: uid!,
          type: "tool_borrowing",
          title: `[Mượn CCDC] ${code} - Đã hủy phiếu mượn dụng cụ`,
          body: `Phiếu mượn công cụ dụng cụ đã được hủy bỏ trên hệ thống bởi ${profile.name}.`,
          link: "/tools",
        }))
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") console.warn("[cancelToolBorrowing] In-app notification error:", err);
  }

  revalidatePath("/tools");
  revalidatePath("/products");
}