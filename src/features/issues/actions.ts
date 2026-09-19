"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchBusinessEvent } from "@/features/notifications/server/dispatch-business-event";
import { issueSchema, type IssueInput } from "./schema";

async function issueMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("issues")
      .select(`
        code,
        creator_id,
        destination_type,
        notes,
        zone:zones(name),
        customer:customers(name),
        items:issue_items(
          quantity,
          entered_quantity,
          unit_price,
          sku_name_snapshot,
          uom_name_snapshot,
          skus(
            products(name),
            units(name, symbol)
          )
        )
      `)
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

function formatIssueItems(items?: any[] | null) {
  if (!items || items.length === 0) return undefined;
  return items.map((i) => ({
    name: i.sku_name_snapshot || i.skus?.products?.name || "Vật tư",
    quantity: i.entered_quantity ?? i.quantity,
    unit: i.uom_name_snapshot || i.skus?.units?.name || i.skus?.units?.symbol || "",
  }));
}

export async function createIssue(input: IssueInput) {
  const profile = await requireManager();
  const parsed = issueSchema.parse(input);
  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    sku_id: i.skuId || i.variantId,
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
    const _destName = (meta?.zone as { name?: string } | null)?.name || (meta?.customer as { name?: string } | null)?.name;

    await dispatchBusinessEvent({
      supabase,
      input: {
        event: "issue.created",
        actorId: profile.id,
        subject: { type: "issue", id: issueId },
        payload: {
          code,
          destinationType: parsed.destinationType,
          zoneName: (meta?.zone as { name?: string } | null)?.name,
          customerName: (meta?.customer as { name?: string } | null)?.name,
          issuerName: profile.name,
          items: formatIssueItems((meta as any)?.items),
          notes: parsed.notes ?? undefined,
        },
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
  const _destName = (meta?.zone as { name?: string } | null)?.name || (meta?.customer as { name?: string } | null)?.name;
  const isSale = meta?.destination_type === "customer";
  if (isSale) {
    await dispatchBusinessEvent({
      supabase,
      input: {
        event: "issue.sale_posted",
        actorId: profile.id,
        subject: { type: "issue", id },
        payload: {
          code,
          customerName: (meta?.customer as { name?: string } | null)?.name,
          items: formatIssueItems((meta as any)?.items),
          issuerName: profile.name,
        },
      },
    });
  } else {
    await dispatchBusinessEvent({
      supabase,
      input: {
        event: "issue.internal_action_required",
        actorId: profile.id,
        subject: { type: "issue", id },
        payload: {
          code,
          zoneName: (meta?.zone as { name?: string } | null)?.name,
          items: formatIssueItems((meta as any)?.items),
          issuerName: profile.name,
        },
      },
    });
  }

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

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "issue.cancelled",
      actorId: profile.id,
      subject: { type: "issue", id },
      payload: {
        code,
        destinationType: meta?.destination_type as any,
        issuerName: profile.name,
        items: formatIssueItems((meta as any)?.items),
      },
    },
  });

  revalidatePath("/issues");
}