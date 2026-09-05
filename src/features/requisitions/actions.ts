"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requisitionSchema, type RequisitionInput } from "./schema";

export async function createRequisition(input: RequisitionInput) {
  const profile = await requireProfile();
  const parsed = requisitionSchema.parse(input);

  const supabase = await createClient();
  const items = parsed.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity }));

  const { data, error } = await supabase.rpc("create_requisition", {
    p_items: items,
    p_zone_id: parsed.zoneId,
    p_purpose: parsed.purpose,
    p_type: parsed.requisitionType,
    p_linked_defect_id: parsed.linkedDefectId ?? (null as unknown as string),
    p_requester_id: profile.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/requisitions");
  return data as string;
}

export async function submitRequisition(id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_requisition", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function approveRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_requisition", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function fulfillRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("fulfill_requisition", { p_id: id, p_by: profile.id, p_notes: "" });
  if (error) throw new Error(error.message);
  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function receiveRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_requisition", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function rejectRequisition(id: string, reason: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_requisition", { p_id: id, p_by: profile.id, p_reason: reason });
  if (error) throw new Error(error.message);
  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function cancelRequisition(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_requisition", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}

export async function returnRequisitionItems(requisitionId: string, items: { variantId: string; quantity: number }[]) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_requisition_items", {
    p_requisition_id: requisitionId,
    p_items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/requisitions/${requisitionId}`);
  revalidatePath("/products");
}
