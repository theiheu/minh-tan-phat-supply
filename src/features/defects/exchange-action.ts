"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const LIVE_STATUSES = ["draft", "pending", "approved", "issued", "received"] as const;

export async function createReplacementRequest(noteId: string): Promise<string> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: note, error: noteErr } = await supabase
    .from("defect_notes")
    .select(
      "id, code, status, reported_by, defect_note_items(id, variant_id, quantity, damage_detail, images)",
    )
    .eq("id", noteId)
    .single();
  if (noteErr || !note) throw new Error("Không tìm thấy phiếu hỏng");
  const reporterId = note.reported_by;
  if (!reporterId) throw new Error("Phiếu hỏng thiếu người lập");

  if (note.status !== "staging") throw new Error("Chỉ phiếu hỏng đang tập kết mới tạo được yêu cầu đổi mới");
  const isOwner = reporterId === profile.id;
  if (!isOwner && profile.role !== "manager") throw new Error("Bạn không có quyền tạo yêu cầu cho phiếu hỏng này");

  const items = note.defect_note_items ?? [];
  if (items.length === 0) throw new Error("Phiếu hỏng không có dòng vật tư");
  for (const it of items) {
    if (!it.damage_detail || !it.images || it.images.length === 0) {
      throw new Error("Phiếu hỏng chưa đủ thông tin/ảnh — cần bổ sung trước khi đổi mới");
    }
  }

  // Chống trùng: đã có phiếu Đổi mới liên kết đang sống?
  const { data: existing } = await supabase
    .from("requisitions")
    .select("id")
    .eq("linked_defect_id", noteId)
    .in("status", LIVE_STATUSES);
  if ((existing ?? []).length > 0) throw new Error("Phiếu hỏng này đã có yêu cầu đổi mới đang xử lý");

  // Lấy zone của người yêu cầu (người lập HONG)
  const { data: requesterProfile } = await supabase
    .from("profiles")
    .select("zone_id")
    .eq("id", reporterId)
    .single();
  const zoneId = requesterProfile?.zone_id ?? null;

  const { data: reqId, error: rpcErr } = await supabase.rpc("create_requisition", {
    p_items: items.map((it) => ({ variant_id: it.variant_id, quantity: it.quantity })),
    p_zone_id: zoneId as string, // generated type khai báo non-null; DB chấp nhận null
    p_purpose: `Thay thế vật tư hỏng ${note.code}`,
    p_type: "replacement",
    p_linked_defect_id: noteId,
    p_requester_id: reporterId,
  });
  if (rpcErr) throw new Error(rpcErr.message);
  if (!reqId) throw new Error("Không tạo được phiếu yêu cầu");

  revalidatePath("/defects");
  revalidatePath("/requisitions");
  return reqId as string;
}
