"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { issueSchema, type IssueInput } from "./schema";

export async function createIssue(input: IssueInput) {
  const profile = await requireManager(); // trả profile chứa .id
  const parsed = issueSchema.parse(input);
  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    variant_id: i.variantId,
    quantity: i.quantity,
    unit_price: i.unitPrice ?? null,
  }));
  // Args của RPC được typegen là string không rỗng — nullable uuid/text phải cast null
  // (giống create_receipt: p_supplier_id: parsed.supplierId ?? (null as unknown as string)).
  const { data, error } = await supabase.rpc("create_issue", {
    p_items: items,
    p_destination_type: parsed.destinationType,
    p_zone_id: parsed.zoneId ?? (null as unknown as string),
    p_customer_id: parsed.customerId ?? (null as unknown as string),
    p_vehicle_plate: parsed.vehiclePlate ?? (null as unknown as string),
    p_driver_name: parsed.driverName ?? (null as unknown as string),
    p_notes: parsed.notes ?? (null as unknown as string),
    p_by: profile.id,
    p_sub_zone_id: parsed.subZoneId ?? (null as unknown as string),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/issues");
  return data as string;
}

export async function postIssue(id: string) {
  const profile = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_issue", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  for (const p of ["/issues", "/dashboard", "/products", "/reports"]) revalidatePath(p);
}

export async function updateIssueInvoiceImages(id: string, invoiceImages: string[]) {
  const profile = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_issue_invoice_images", {
    p_id: id,
    p_invoice_images: invoiceImages,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/issues");
  revalidatePath(`/issues/${id}`);
}

export async function cancelIssue(id: string) {
  const profile = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_issue", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/issues");
}
