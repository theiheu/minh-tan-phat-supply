"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getManagerIds, notifyUsers } from "@/lib/notifications";
import { issueSchema, type IssueInput } from "./schema";

async function issueMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("issues")
      .select("code, creator_id, destination_type, notes, zone:zones(name), customer:customers(name)")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function createIssue(input: IssueInput) {
  const profile = await requireManager();
  const parsed = issueSchema.parse(input);
  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    sku_id: i.skuId || i.variantId,
    variant_id: i.skuId || i.variantId,
    entered_quantity: i.enteredQuantity ?? i.quantity,
    quantity: i.enteredQuantity ?? i.quantity,
    transaction_unit_id: i.transactionUnitId ?? null,
    unit_price: i.unitPrice ?? null,
    allocations: (i.batchNo || i.expiryDate) ? [{
      lot_number: i.batchNo || undefined,
      expiry_date: i.expiryDate || undefined,
    }] : i.allocations ?? null,
  }));

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

  const issueId = data as string;
  if (issueId) {
    const meta = await issueMeta(issueId);
    const code = meta?.code ?? "PXK";
    const destName = (meta?.zone as { name?: string } | null)?.name || (meta?.customer as { name?: string } | null)?.name;

    await notifyUsers({
      userIds: await getManagerIds(supabase),
      type: "issue",
      title: `[Xuất kho] ${code} - Tạo mới phiếu xuất kho`,
      body: `Người lập ${profile.name} đã tạo phiếu xuất kho${destName ? ` tới ${destName}` : ""}, chờ xuất kho và ghi sổ.`,
      link: `/issues/${issueId}`,
      document: {
        code,
        type: "Phiếu xuất kho",
        status: "Chờ xuất kho",
        statusVariant: "warning",
        creatorName: profile.name,
        locationName: destName,
        notes: parsed.notes,
      },
    });
  }

  revalidatePath("/issues");
  return data as string;
}

export async function postIssue(id: string) {
  const profile = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_issue", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const meta = await issueMeta(id);
  const code = meta?.code ?? "PXK";
  const destName = (meta?.zone as { name?: string } | null)?.name || (meta?.customer as { name?: string } | null)?.name;
  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.creator_id, ...managers])];

  await notifyUsers({
    userIds,
    type: "issue",
    title: `[Xuất kho] ${code} - Hoàn tất xuất kho (Ghi nhận sổ kho)`,
    body: `Thủ kho ${profile.name} đã hoàn tất xuất kho. Tồn kho đã được trừ tương ứng trên hệ thống MTP-ERN.`,
    link: `/issues/${id}`,
    document: {
      code,
      type: "Phiếu xuất kho",
      status: "Đã xuất kho",
      statusVariant: "success",
      handlerName: profile.name,
      locationName: destName,
    },
  });

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

  const meta = await issueMeta(id);
  const code = meta?.code ?? "PXK";

  const { error } = await supabase.rpc("cancel_issue", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);

  const managers = await getManagerIds(supabase);
  const userIds = [...new Set([meta?.creator_id, ...managers])];

  await notifyUsers({
    userIds,
    type: "issue",
    title: `[Xuất kho] ${code} - Đã hủy phiếu xuất kho`,
    body: `Phiếu xuất kho đã được hủy bỏ trên hệ thống bởi ${profile.name}.`,
    link: "/issues",
    document: {
      code,
      type: "Phiếu xuất kho",
      status: "Đã hủy",
      statusVariant: "neutral",
      handlerName: profile.name,
    },
  });

  revalidatePath("/issues");
}
