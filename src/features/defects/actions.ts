"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isPrivileged } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { defectSchema, type DefectInput } from "./schema";

export async function recordDefect(input: DefectInput) {
  const profile = await requireProfile();
  const parsed = defectSchema.parse(input);

  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    variant_id: i.variantId,
    quantity: i.quantity,
    damage_detail: i.damageDetail,
    damage_type: null,
    severity: null,
    images: i.images,
    note: i.note ?? "",
  }));

  const { data, error } = await supabase.rpc("record_defect", {
    p_items: items,
    p_source_loc: parsed.sourceLocationId,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/defects");
  revalidatePath("/products");
  return data as string;
}

export async function updateDefectItemImages(itemId: string, images: string[]) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_defect_item_images", {
    p_item_id: itemId,
    p_images: images,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/defects");
}

export async function cancelDefect(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_defect", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/defects");
}

export async function updateDefect(id: string, input: DefectInput) {
  const profile = await requireProfile();
  const parsed = defectSchema.parse(input);
  const isMgr = isPrivileged(profile.role);
  const admin = createAdminClient();

  const { data: note, error: fetchErr } = await admin
    .from("defect_notes")
    .select("id, status, reported_by")
    .eq("id", id)
    .single();

  if (fetchErr || !note) throw new Error("Không tìm thấy phiếu hỏng");
  if (!isMgr && note.reported_by !== profile.id) {
    throw new Error("Bạn không có quyền chỉnh sửa phiếu này");
  }
  if (note.status !== "staging" && !isMgr) {
    throw new Error("Chỉ có thể chỉnh sửa phiếu ở trạng thái tập kết");
  }

  const { error: updateNoteErr } = await admin
    .from("defect_notes")
    .update({
      source_location_id: parsed.sourceLocationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateNoteErr) throw new Error(updateNoteErr.message);

  await admin.from("defect_note_items").delete().eq("defect_note_id", id);

  const itemsToInsert = parsed.items.map((i) => ({
    defect_note_id: id,
    variant_id: i.variantId,
    quantity: i.quantity,
    damage_detail: i.damageDetail,
    note: i.note ?? "",
    images: i.images,
  }));

  const { error: insertItemsErr } = await admin.from("defect_note_items").insert(itemsToInsert);
  if (insertItemsErr) throw new Error(insertItemsErr.message);

  await admin.from("audit_logs").insert({
    actor_id: profile.id,
    action: "defect.update",
    entity_type: "defect",
    entity_id: id,
    after: { source_location_id: parsed.sourceLocationId, itemsCount: itemsToInsert.length },
  });

  revalidatePath("/defects");
  revalidatePath("/products");
}

export async function deleteDefect(id: string) {
  const profile = await requireProfile();
  const isMgr = isPrivileged(profile.role);
  const admin = createAdminClient();

  const { data: note, error: fetchErr } = await admin
    .from("defect_notes")
    .select("id, code, status, reported_by")
    .eq("id", id)
    .single();

  if (fetchErr || !note) throw new Error("Không tìm thấy phiếu hỏng");
  if (!isMgr && note.reported_by !== profile.id) {
    throw new Error("Bạn không có quyền xóa phiếu này");
  }

  // Xóa các exchange_notes và items liên kết (nếu có)
  const { data: linkedEx } = await admin.from("exchange_notes").select("id").eq("linked_defect_id", id);
  for (const ex of linkedEx ?? []) {
    await admin.from("exchange_note_items").delete().eq("exchange_note_id", ex.id);
    await admin.from("exchange_notes").delete().eq("id", ex.id);
  }

  // Xóa các repair_order_items liên quan (nếu có)
  const { data: defectItems } = await admin.from("defect_note_items").select("id").eq("defect_note_id", id);
  const defectItemIds = (defectItems ?? []).map((i) => i.id);
  if (defectItemIds.length > 0) {
    await admin.from("repair_order_items").delete().in("defect_item_id", defectItemIds);
  }

  // Xóa defect_note_items và defect_notes
  await admin.from("defect_note_items").delete().eq("defect_note_id", id);
  const { error: delErr } = await admin.from("defect_notes").delete().eq("id", id);
  if (delErr) throw new Error(delErr.message);

  await admin.from("audit_logs").insert({
    actor_id: profile.id,
    action: "defect.delete",
    entity_type: "defect",
    entity_id: id,
    before: { code: note.code, status: note.status },
  });

  revalidatePath("/defects");
  revalidatePath("/products");
}

export async function toggleDefectCollected(id: string, collected: boolean) {
  const profile = await requireProfile();
  const isMgr = isPrivileged(profile.role);
  const admin = createAdminClient();

  const { data: note, error: fetchErr } = await admin
    .from("defect_notes")
    .select("id, reported_by")
    .eq("id", id)
    .single();

  if (fetchErr || !note) throw new Error("Không tìm thấy phiếu hỏng");
  if (!isMgr && note.reported_by !== profile.id) {
    throw new Error("Bạn không có quyền thực hiện thao tác này");
  }

  const { error } = await admin
    .from("defect_notes")
    .update({
      collected_at: collected ? new Date().toISOString() : null,
      collected_by: collected ? profile.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/defects");
}

export async function requestRepair(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_repair", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/defects");
}

export async function cancelRepairRequest(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_repair_request", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/defects");
}
