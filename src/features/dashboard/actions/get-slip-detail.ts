"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface SlipDetailPayload {
  type: string;
  id: string;
  code: string;
  status: string;
  createdAt: string;
  creatorName?: string | null;
  requesterId?: string | null;
  zoneName?: string | null;
  supplierName?: string | null;
  customerName?: string | null;
  purposeOrNotes?: string | null;
  rejectionReason?: string | null;
  invoiceImages?: string[];
  vehiclePlate?: string | null;
  driverName?: string | null;
  items: {
    id: string;
    variantId?: string;
    productName: string;
    variantLabel: string;
    unit?: string | null;
    quantity: number;
    unitPrice?: number | null;
    batchNo?: string | null;
    expiryDate?: string | null;
    damageDetail?: string | null;
    images?: string[];
    note?: string | null;
  }[];
  timeline?: {
    label: string;
    at?: string | null;
    by?: string | null;
  }[];
  pdfUrl?: string;
}

export interface GetSlipDetailResult {
  detail: SlipDetailPayload | null;
  currentUser: {
    id: string;
    role: string;
    name: string | null;
  } | null;
  error?: string;
}

function variantLabelFor(variants: {
  attributes?: unknown;
  unit?: string | null;
} | null): string {
  if (variants?.attributes && typeof variants.attributes === "object" && !Array.isArray(variants.attributes)) {
    const values = Object.values(variants.attributes as Record<string, unknown>).filter(
      (v) => typeof v === "string" && v.length > 0,
    );
    if (values.length > 0) return values.join(" · ");
  }
  return variants?.unit ?? "—";
}

export async function getSlipDetail(
  entityType: string,
  id: string,
): Promise<GetSlipDetailResult> {
  try {
    const supabase = await createClient();
    const profile = await getCurrentProfile();
    const t = entityType.toLowerCase().trim();

    const currentUser = profile
      ? { id: profile.id, role: profile.role, name: profile.name }
      : null;

    if (t === "requisition" || t === "requisitions") {
      const { data: req, error } = await supabase
        .from("requisitions")
        .select(
          "id, code, purpose, status, requisition_type, requester_id, created_at, approved_at, fulfilled_at, received_at, rejection_reason, fulfillment_notes, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name), approver:profiles!requisitions_approved_by_fkey(name), fulfiller:profiles!requisitions_fulfilled_by_fkey(name), receiver:profiles!requisitions_received_by_fkey(name), items:requisition_items(id, variant_id, quantity, variants(attributes, unit, products(name)))",
        )
        .eq("id", id)
        .single();

      if (error || !req) return { detail: null, currentUser, error: "Không tìm thấy phiếu yêu cầu" };

      const items = (req.items ?? []).map((it) => {
        const v = it.variants as { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
        return {
          id: it.id,
          variantId: it.variant_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit: v?.unit,
          quantity: it.quantity,
        };
      });

      const timeline = [
        { label: "Tạo phiếu", at: req.created_at, by: req.requester?.name },
        { label: "Duyệt phiếu", at: req.approved_at, by: req.approver?.name },
        { label: "Cấp phát", at: req.fulfilled_at, by: req.fulfiller?.name },
        { label: "Nhận hàng", at: req.received_at, by: req.receiver?.name },
      ].filter((m) => Boolean(m.at));

      return {
        currentUser,
        detail: {
          type: "requisition",
          id: req.id,
          code: req.code,
          status: req.status,
          createdAt: req.created_at,
          creatorName: req.requester?.name,
          requesterId: req.requester_id,
          zoneName: req.zone?.name,
          purposeOrNotes: req.purpose,
          rejectionReason: req.rejection_reason,
          items,
          timeline,
          pdfUrl: `/api/requisitions/${req.id}/pdf`,
        },
      };
    }

    if (t === "receipt" || t === "receipts") {
      const { data: rec, error } = await supabase
        .from("receipts")
        .select(
          "id, code, notes, status, invoice_images, created_at, approved_at, updated_at, supplier:suppliers!receipts_supplier_id_fkey(name), creator:profiles!receipts_created_by_fkey(name), approver:profiles!receipts_approved_by_fkey(name), items:receipt_items(id, variant_id, quantity, unit_cost, batch_no, expiry_date, variants(attributes, unit, products(name)))",
        )
        .eq("id", id)
        .single();

      if (error || !rec) return { detail: null, currentUser, error: "Không tìm thấy phiếu nhập kho" };

      const items = (rec.items ?? []).map((it) => {
        const v = it.variants as { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
        return {
          id: it.id,
          variantId: it.variant_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit: v?.unit,
          quantity: it.quantity,
          unitPrice: it.unit_cost ? Number(it.unit_cost) : null,
          batchNo: it.batch_no,
          expiryDate: it.expiry_date,
        };
      });

      const timeline = [
        { label: "Tạo phiếu", at: rec.created_at, by: rec.creator?.name ?? null },
        { label: "Duyệt đặt hàng", at: rec.approved_at, by: rec.approver?.name ?? null },
        rec.status === "posted" ? { label: "Nhập kho", at: rec.updated_at, by: rec.approver?.name ?? rec.creator?.name ?? null } : null,
      ].filter((m): m is { label: string; at: string | null; by: string | null } => m !== null && Boolean(m.at));

      return {
        currentUser,
        detail: {
          type: "receipt",
          id: rec.id,
          code: rec.code,
          status: rec.status,
          createdAt: rec.created_at,
          creatorName: rec.creator?.name,
          supplierName: rec.supplier?.name,
          purposeOrNotes: rec.notes,
          invoiceImages: rec.invoice_images ?? [],
          items,
          timeline,
          pdfUrl: `/api/receipts/${rec.id}/pdf`,
        },
      };
    }

    if (t === "issue" || t === "issues") {
      const { data: iss, error } = await supabase
        .from("issues")
        .select(
          "id, code, destination_type, status, notes, vehicle_plate, driver_name, created_at, customer:customers(name), zone:zones(name), creator:profiles(name), items:issue_items(id, variant_id, quantity, unit_price, variants(attributes, unit, products(name)))",
        )
        .eq("id", id)
        .single();

      if (error || !iss) return { detail: null, currentUser, error: "Không tìm thấy phiếu xuất kho" };

      const items = (iss.items ?? []).map((it) => {
        const v = it.variants as { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
        return {
          id: it.id,
          variantId: it.variant_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit: v?.unit,
          quantity: it.quantity,
          unitPrice: it.unit_price ? Number(it.unit_price) : null,
        };
      });

      return {
        currentUser,
        detail: {
          type: "issue",
          id: iss.id,
          code: iss.code,
          status: iss.status,
          createdAt: iss.created_at,
          creatorName: iss.creator?.name,
          zoneName: iss.zone?.name,
          customerName: iss.customer?.name,
          purposeOrNotes: iss.notes,
          vehiclePlate: iss.vehicle_plate,
          driverName: iss.driver_name,
          items,
          pdfUrl: `/api/issues/${iss.id}/pdf`,
        },
      };
    }

    if (t.startsWith("exchange")) {
      const { data: ex, error } = await supabase
        .from("exchange_notes")
        .select(
          "id, code, linked_defect_id, status, rejection_reason, created_at, approved_at, issued_at, received_at, creator:profiles!exchange_notes_created_by_fkey(name), approver:profiles!exchange_notes_approved_by_fkey(name), issuer:profiles!exchange_notes_issued_by_fkey(name), receiver:profiles!exchange_notes_received_by_fkey(name), defect:defect_notes!exchange_notes_linked_defect_id_fkey(code, defect_note_items(id, variant_id, quantity, damage_detail, note, images, variants(attributes, unit, products(name))))",
        )
        .eq("id", id)
        .single();

      if (error || !ex) return { detail: null, currentUser, error: "Không tìm thấy phiếu đổi mới" };

      const d = ex.defect;
      const items = (d?.defect_note_items ?? []).map((it) => {
        const v = it.variants as { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
        return {
          id: it.id,
          variantId: it.variant_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit: v?.unit,
          quantity: it.quantity,
          damageDetail: it.damage_detail,
          images: it.images ?? [],
          note: it.note,
        };
      });

      const timeline = [
        { label: "Tạo đổi mới", at: ex.created_at, by: ex.creator?.name },
        { label: "Duyệt đổi mới", at: ex.approved_at, by: ex.approver?.name },
        { label: "Cấp phát đổi mới", at: ex.issued_at, by: ex.issuer?.name },
        { label: "Nhận hàng", at: ex.received_at, by: ex.receiver?.name },
      ].filter((m) => Boolean(m.at));

      return {
        currentUser,
        detail: {
          type: "exchange",
          id: ex.id,
          code: ex.code,
          status: ex.status,
          createdAt: ex.created_at,
          creatorName: ex.creator?.name,
          rejectionReason: ex.rejection_reason,
          purposeOrNotes: d?.code ? `Đổi mới cho phiếu hỏng ${d.code}` : undefined,
          items,
          timeline,
        },
      };
    }

    if (t.startsWith("defect")) {
      const { data: def, error } = await supabase
        .from("defect_notes")
        .select(
          "id, code, status, notes, repair_requested_at, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), location:stock_locations!defect_notes_source_location_id_fkey(name), items:defect_note_items(id, variant_id, quantity, damage_detail, note, images, variants(attributes, unit, products(name)))",
        )
        .eq("id", id)
        .single();

      if (error || !def) return { detail: null, currentUser, error: "Không tìm thấy phiếu báo hỏng" };

      const items = (def.items ?? []).map((it) => {
        const v = it.variants as { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
        return {
          id: it.id,
          variantId: it.variant_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit: v?.unit,
          quantity: it.quantity,
          damageDetail: it.damage_detail,
          images: it.images ?? [],
          note: it.note,
        };
      });

      return {
        currentUser,
        detail: {
          type: "defect",
          id: def.id,
          code: def.code,
          status: def.status,
          createdAt: def.created_at,
          creatorName: def.reporter?.name,
          zoneName: def.location?.name,
          purposeOrNotes: def.notes,
          items,
          pdfUrl: `/api/defects/${def.id}/pdf`,
        },
      };
    }

    if (t.startsWith("liquidation")) {
      const { data: liq, error } = await supabase
        .from("liquidation_notes")
        .select(
          "id, code, status, notes, created_at, creator:profiles!liquidation_notes_created_by_fkey(name), items:liquidation_items(id, quantity, proceeds, notes, variants(attributes, unit, products(name)))",
        )
        .eq("id", id)
        .single();

      if (error || !liq) return { detail: null, currentUser, error: "Không tìm thấy phiếu thanh lý" };

      const items = (liq.items ?? []).map((it) => {
        const v = it.variants as { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
        return {
          id: it.id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit: v?.unit,
          quantity: it.quantity,
          unitPrice: it.proceeds ? Number(it.proceeds) : null,
          damageDetail: it.notes,
        };
      });

      return {
        currentUser,
        detail: {
          type: "liquidation",
          id: liq.id,
          code: liq.code,
          status: liq.status,
          createdAt: liq.created_at,
          creatorName: liq.creator?.name,
          purposeOrNotes: liq.notes,
          items,
          pdfUrl: `/api/liquidations/${liq.id}/pdf`,
        },
      };
    }

    if (t.startsWith("repair")) {
      const { data: rep, error } = await supabase
        .from("repair_orders")
        .select(
          "id, code, vendor, status, total_cost, sent_at, expected_return_at, created_at, items:repair_order_items(id, quantity, variants(attributes, unit, products(name)))",
        )
        .eq("id", id)
        .single();

      if (error || !rep) return { detail: null, currentUser, error: "Không tìm thấy phiếu sửa chữa" };

      const items = (rep.items ?? []).map((it) => {
        const v = it.variants as { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
        return {
          id: it.id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit: v?.unit,
          quantity: it.quantity,
        };
      });

      return {
        currentUser,
        detail: {
          type: "repair",
          id: rep.id,
          code: rep.code,
          status: rep.status,
          createdAt: rep.created_at,
          supplierName: rep.vendor,
          items,
          pdfUrl: `/api/repairs/${rep.id}/pdf`,
        },
      };
    }

    return { detail: null, currentUser, error: "Loại phiếu không hợp lệ" };
  } catch (err) {
    return {
      detail: null,
      currentUser: null,
      error: err instanceof Error ? err.message : "Không thể tải chi tiết phiếu",
    };
  }
}
