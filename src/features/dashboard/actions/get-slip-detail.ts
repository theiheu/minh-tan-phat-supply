"use server";

import { getCurrentProfile } from "@/lib/auth";
import { formatZoneLabel } from "@/lib/format-zone";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditActionLabel, auditActionTone, type StatusBadgeVariant } from "@/lib/labels";

export interface SlipTimelineEvent {
  key: string;
  label: string;
  tone?: StatusBadgeVariant;
  at?: string | null;
  by?: string | null;
  note?: string | null;
  detail?: string | null;
}

export interface SlipDetailPayload {
  type: string;
  id: string;
  code: string;
  status: string;
  createdAt: string;
  creatorName?: string | null;
  creatorId?: string | null;
  requesterId?: string | null;
  zoneName?: string | null;
  supplierName?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  destinationType?: string | null;
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
    /** Tồn kho hiện tại tại Kho chính (chỉ phiếu yêu cầu vật tư). */
    stock?: number | null;
    /** Số lượng đã trả lại kho trước đó (chỉ phiếu yêu cầu vật tư). */
    returned?: number;
  }[];
  linkedRequisitions?: {
    id: string;
    code: string;
    requesterName?: string | null;
    purpose?: string | null;
    status: string;
  }[];
  linkedReceipt?: {
    id: string;
    code: string;
    status: string;
    supplierName?: string | null;
    creatorName?: string | null;
    createdAt: string;
    notes?: string | null;
  } | null;
  defectEvidence?: {
    code: string;
    items: {
      id: string;
      productName?: string | null;
      unit?: string | null;
      quantity: number;
      damageDetail?: string | null;
      images: string[];
    }[];
  } | null;
  timeline?: SlipTimelineEvent[];
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
  units?: { name?: string | null; symbol?: string | null } | null;
  sku_attribute_values?: Array<{
    text_value?: string | null;
    legacy_text_value?: string | null;
    numeric_value?: number | null;
    units?: { symbol?: string | null } | null;
  }> | null;
} | null): string {
  if (variants?.sku_attribute_values && variants.sku_attribute_values.length > 0) {
    const vals = variants.sku_attribute_values
      .map((av) => av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null))
      .filter(Boolean);
    if (vals.length > 0) return vals.join(" · ");
  }
  if (variants?.attributes && typeof variants.attributes === "object" && !Array.isArray(variants.attributes)) {
    const values = Object.values(variants.attributes as Record<string, unknown>).filter(
      (v) => typeof v === "string" && v.length > 0,
    );
    if (values.length > 0) return values.join(" · ");
  }
  return "—";
}

function cleanTimeline(events: (SlipTimelineEvent | null)[]): SlipTimelineEvent[] {
  return events.filter((m): m is SlipTimelineEvent => m !== null && Boolean(m.at));
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

    // Lấy audit logs nếu có
    const auditEntityType =
      t.startsWith("requisition") ? "requisition"
      : t.startsWith("receipt") ? "receipt"
      : t.startsWith("issue") ? "issue"
      : t.startsWith("exchange") ? "exchange"
      : t.startsWith("defect") ? "defect"
      : t.startsWith("repair") ? "repair"
      : t.startsWith("liquidation") ? "liquidation"
      : t.startsWith("stocktake") ? "stocktake"
      : t;

    const adminClient = createAdminClient();
    const { data: auditLogs } = await adminClient
      .from("audit_logs")
      .select("id, action, created_at, after, actor:profiles!audit_logs_actor_id_fkey(name)")
      .eq("entity_type", auditEntityType)
      .eq("entity_id", id)
      .order("created_at", { ascending: true });

    if (t === "requisition" || t === "requisitions") {
      const { data: req, error } = await supabase
        .from("requisitions")
        .select(
          "id, code, purpose, status, requisition_type, linked_defect_id, requester_id, invoice_images, created_at, approved_at, fulfilled_at, received_at, rejection_reason, fulfillment_notes, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name), sub_zone:sub_zones!requisitions_sub_zone_id_fkey(name), approver:profiles!requisitions_approved_by_fkey(name), fulfiller:profiles!requisitions_fulfilled_by_fkey(name), receiver:profiles!requisitions_received_by_fkey(name), items:requisition_items(id, sku_id, quantity, skus(id, sku_code, price, images, products(name, images, description), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol))))",
        )
        .eq("id", id)
        .single();

      if (error || !req) return { detail: null, currentUser, error: "Không tìm thấy phiếu yêu cầu" };

      // Lấy tồn kho hiện tại từng vật tư
      const variantIds = [...new Set((req.items ?? []).map((i) => i.sku_id).filter((v): v is string => Boolean(v)))];
      const stockByVariant = new Map<string, number>();
      if (variantIds.length > 0) {
        const { data: stockRows } = await supabase
          .from("sku_stock")
          .select("sku_id, quantity")
          .in("sku_id", variantIds);
        for (const s of stockRows ?? []) {
          if (s.sku_id != null && s.quantity != null) stockByVariant.set(s.sku_id, s.quantity);
        }
      }

      // Lấy lịch sử trả lại vật tư (tổng đã trả theo variant — dùng cho form trả trong modal).
      const { data: returnEvents } = await supabase
        .from("requisition_returns")
        .select("id, created_at, returnedBy:profiles!requisition_returns_returned_by_fkey(name), items:requisition_return_items(sku_id, quantity, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol))))")
        .eq("requisition_id", req.id)
        .order("created_at", { ascending: true });

      const returnedByVariant = new Map<string, number>();
      for (const ev of (returnEvents ?? []) as { items?: { sku_id?: string | null; quantity: number }[] }[]) {
        for (const it of ev.items ?? []) {
          if (it.sku_id) returnedByVariant.set(it.sku_id, (returnedByVariant.get(it.sku_id) ?? 0) + it.quantity);
        }
      }

      const items = (req.items ?? []).map((it) => {
        const v = it.skus as {
          attributes?: unknown;
          unit?: string | null;
          units?: { name?: string | null; symbol?: string | null } | null;
          sku_attribute_values?: Array<{
            text_value?: string | null;
            legacy_text_value?: string | null;
            numeric_value?: number | null;
            units?: { symbol?: string | null } | null;
          }> | null;
          images?: string[] | null;
          products?: { name?: string | null; images?: string[] | null; description?: string | null } | null;
        } | null;
        const images = v?.images ?? [];
        const unit = v?.units?.symbol || v?.units?.name || v?.unit || "—";
        return {
          id: it.id,
          variantId: it.sku_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit,
          quantity: it.quantity,
          images,
          stock: it.sku_id ? (stockByVariant.get(it.sku_id) ?? null) : null,
          returned: it.sku_id ? (returnedByVariant.get(it.sku_id) ?? 0) : 0,
        };
      });

      // Lấy bằng chứng hỏng nếu là phiếu thay thế/đổi mới
      let defectEvidence: SlipDetailPayload["defectEvidence"] = null;
      if (req.requisition_type === "replacement" && req.linked_defect_id) {
        const [{ data: dnote }, { data: ditems }] = await Promise.all([
          supabase.from("defect_notes").select("code").eq("id", req.linked_defect_id).single(),
          supabase
            .from("defect_note_items")
            .select("id, quantity, damage_detail, images, skus(products(name), units(name, symbol))")
            .eq("defect_note_id", req.linked_defect_id),
        ]);
        if (dnote) {
          defectEvidence = {
            code: dnote.code,
            items: (ditems ?? []).map((it) => {
              const v = it.skus as { units?: { symbol?: string | null; name?: string | null } | null; products?: { name: string | null } | null } | null;
              return {
                id: it.id,
                productName: v?.products?.name ?? null,
                unit: v?.units?.symbol || v?.units?.name || null,
                quantity: it.quantity,
                damageDetail: it.damage_detail,
                images: it.images ?? [],
              };
            }),
          };
        }
      }

      // Lịch sử trả lại vật tư → mốc trên timeline
      const returnMilestones: SlipTimelineEvent[] = (returnEvents ?? []).map((ev) => {
        const typed = ev as {
          created_at: string;
          returnedBy?: { name?: string | null } | null;
          items?: {
            quantity: number;
            skus?: { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
          }[];
        };
        const lines = (typed.items ?? []).map((it) => {
          const name = it.skus?.products?.name ?? "Vật tư";
          const label = variantLabelFor(it.skus ?? null);
          return label && label !== "—" ? `${name} — ${label} × ${it.quantity}` : `${name} × ${it.quantity}`;
        });
        return {
          key: "requisition.return",
          label: "Trả lại vật tư",
          tone: "info" as const,
          at: typed.created_at,
          by: typed.returnedBy?.name ?? null,
          detail: lines.length > 0 ? lines.join(", ") : undefined,
        };
      });

      // Lấy thông tin phiếu đặt hàng nhập kho liên quan (nếu có)
      const { data: linkedReceipts } = await supabase
        .from("receipts")
        .select("id, code, status, notes, created_at, supplier:suppliers!receipts_supplier_id_fkey(name), creator:profiles!receipts_created_by_fkey(name)")
        .contains("linked_requisition_ids", [req.id]);

      const linkedReceipt = linkedReceipts?.[0] ?? null;

      let timeline: SlipTimelineEvent[] = [];
      if (auditLogs && auditLogs.length > 0) {
        timeline = auditLogs
          .filter((a) => a.action !== "requisition.return")
          .map((a) => {
            // Trường hợp tạo hộ phiếu yêu cầu cho người khác:
            // - Tiến trình tạo phiếu: tên tài khoản tạo phiếu (a.actor?.name)
            // - Tiến trình gửi phiếu yêu cầu: tên tài khoản được tạo hộ phiếu (req.requester?.name)
            const actorName =
              a.action === "requisition.submit"
                ? (req.requester?.name ?? a.actor?.name ?? null)
                : (a.actor?.name ?? null);

            let eventDetail: string | undefined = undefined;
            if (a.action === "requisition.order") {
              const afterObj = a.after as { receipt_code?: string; supplier_name?: string; notes?: string } | null;
              eventDetail = afterObj?.receipt_code
                ? `Phiếu đặt hàng: ${afterObj.receipt_code}${afterObj.supplier_name ? ` · NCC: ${afterObj.supplier_name}` : ""}${afterObj.notes ? ` (${afterObj.notes})` : ""}`
                : linkedReceipt
                ? `Phiếu đặt hàng: ${linkedReceipt.code}`
                : undefined;
            } else if (a.action === "requisition.upload_invoice") {
              const afterObj = a.after as { count?: number } | null;
              eventDetail = afterObj?.count
                ? `Đã tải lên ${afterObj.count} ảnh hóa đơn / chứng từ nhận hàng từ NCC`
                : "Đã tải lên ảnh hóa đơn / chứng từ nhận hàng";
            } else if (a.action === "requisition.direct_complete") {
              eventDetail = "Quản kho đã kiểm tra hóa đơn và duyệt hoàn tất nhận hàng trực tiếp";
            }

            return {
              key: a.action,
              label: auditActionLabel(a.action),
              tone: auditActionTone(a.action),
              at: a.created_at,
              by: actorName,
              note: a.action === "requisition.reject" ? req.rejection_reason : null,
              detail: eventDetail,
            };
          });

        if (linkedReceipt && !timeline.some((t) => t.key === "requisition.order")) {
          timeline.push({
            key: "requisition.order",
            label: "Đã đặt hàng NCC",
            tone: "violet",
            at: linkedReceipt.created_at,
            by: (linkedReceipt.creator as { name?: string } | null)?.name ?? null,
            detail: `Phiếu đặt hàng: ${linkedReceipt.code}${(linkedReceipt.supplier as { name?: string } | null)?.name ? ` · NCC: ${(linkedReceipt.supplier as { name?: string } | null)?.name}` : ""}`,
          });
        }

        timeline = [...timeline, ...returnMilestones].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
      } else {
        const createLog = auditLogs?.find((a) => a.action === "requisition.create");
        const creatorName = createLog?.actor?.name ?? req.requester?.name;
        const fallbackOrder = linkedReceipt
          ? {
              key: "requisition.order",
              label: "Đã đặt hàng NCC",
              tone: "violet" as const,
              at: linkedReceipt.created_at,
              by: (linkedReceipt.creator as { name?: string } | null)?.name ?? null,
              detail: `Phiếu đặt hàng: ${linkedReceipt.code}${(linkedReceipt.supplier as { name?: string } | null)?.name ? ` · NCC: ${(linkedReceipt.supplier as { name?: string } | null)?.name}` : ""}`,
            }
          : null;

        timeline = cleanTimeline([
          { key: "requisition.create", label: "Tạo phiếu", tone: "info", at: req.created_at, by: creatorName },
          req.status !== "draft" ? { key: "requisition.submit", label: "Gửi phiếu yêu cầu", tone: "warning", at: req.created_at, by: req.requester?.name } : null,
          { key: "requisition.approve", label: "Duyệt phiếu", tone: "info", at: req.approved_at, by: req.approver?.name },
          fallbackOrder,
          { key: "requisition.fulfill", label: "Cấp phát", tone: "success", at: req.fulfilled_at, by: req.fulfiller?.name },
          { key: "requisition.receive", label: "Xác nhận nhận", tone: "success", at: req.received_at, by: req.receiver?.name },
          ...returnMilestones,
        ]).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
      }

      const createLog = auditLogs?.find((a) => a.action === "requisition.create");
      const creatorName = createLog?.actor?.name ?? req.requester?.name;

      return {
        currentUser,
        detail: {
          type: "requisition",
          id: req.id,
          code: req.code,
          status: req.status,
          createdAt: req.created_at,
          creatorName,
          requesterId: req.requester_id,
          zoneName: formatZoneLabel(req.zone?.name, req.sub_zone?.name),
          purposeOrNotes: req.purpose,
          rejectionReason: req.rejection_reason,
          defectEvidence,
          items,
          invoiceImages: (req as { invoice_images?: string[] }).invoice_images ?? [],
          linkedReceipt: linkedReceipt
            ? {
                id: linkedReceipt.id,
                code: linkedReceipt.code,
                status: linkedReceipt.status,
                supplierName: (linkedReceipt.supplier as { name?: string } | null)?.name,
                creatorName: (linkedReceipt.creator as { name?: string } | null)?.name,
                createdAt: linkedReceipt.created_at,
                notes: linkedReceipt.notes,
              }
            : null,
          timeline,
          pdfUrl: `/api/requisitions/${req.id}/pdf`,
        },
      };
    }

    if (t === "receipt" || t === "receipts") {
      const { data: rec, error } = await supabase
        .from("receipts")
        .select(
          "id, code, notes, status, created_by, invoice_images, linked_requisition_ids, created_at, approved_at, updated_at, supplier:suppliers!receipts_supplier_id_fkey(name), creator:profiles!receipts_created_by_fkey(name), approver:profiles!receipts_approved_by_fkey(name), items:receipt_items(id, sku_id, quantity, unit_cost, batch_no, expiry_date, skus(id, sku_code, price, images, products(name, images), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol))))",
        )
        .eq("id", id)
        .single();

      if (error || !rec) return { detail: null, currentUser, error: "Không tìm thấy phiếu nhập kho" };

      const items = (rec.items ?? []).map((it) => {
        const v = it.skus as {
          attributes?: unknown;
          unit?: string | null;
          units?: { name?: string | null; symbol?: string | null } | null;
          sku_attribute_values?: Array<{
            text_value?: string | null;
            legacy_text_value?: string | null;
            numeric_value?: number | null;
            units?: { symbol?: string | null } | null;
          }> | null;
          images?: string[] | null;
          products?: { name?: string | null; images?: string[] | null } | null;
        } | null;
        const unit = v?.units?.symbol || v?.units?.name || v?.unit || "—";
        const images = (v?.images && v.images.length > 0) ? v.images : (v?.products?.images ?? []);
        return {
          id: it.id,
          variantId: it.sku_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit,
          quantity: it.quantity,
          unitPrice: it.unit_cost ? Number(it.unit_cost) : null,
          batchNo: it.batch_no,
          expiryDate: it.expiry_date,
          images,
        };
      });

      // Lấy danh sách phiếu yêu cầu được auto cấp phát khi ghi nhận nhập kho & đồng bộ ảnh hóa đơn
      let linkedRequisitions: SlipDetailPayload["linkedRequisitions"] = [];
      let extraReqInvoices: string[] = [];
      const linkedIds = rec.linked_requisition_ids ?? [];
      if (linkedIds.length > 0) {
        const { data: lReqs } = await supabase
          .from("requisitions")
          .select("id, code, purpose, status, invoice_images, requester:profiles!requisitions_requester_id_fkey(name)")
          .in("id", linkedIds)
          .order("created_at", { ascending: true });
        linkedRequisitions = (lReqs ?? []).map((rq) => ({
          id: rq.id,
          code: rq.code,
          requesterName: (rq.requester as { name?: string | null } | null)?.name ?? null,
          purpose: rq.purpose,
          status: rq.status,
        }));
        extraReqInvoices = (lReqs ?? []).flatMap((r) => (r as { invoice_images?: string[] }).invoice_images ?? []);
      }

      const mergedInvoiceImages = Array.from(new Set([...(rec.invoice_images ?? []), ...extraReqInvoices])).filter(Boolean);

      let timeline: SlipTimelineEvent[] = [];
      if (auditLogs && auditLogs.length > 0) {
        timeline = auditLogs.map((a) => ({
          key: a.action,
          label: auditActionLabel(a.action),
          tone: auditActionTone(a.action),
          at: a.created_at,
          by: a.actor?.name ?? null,
        }));
      } else {
        timeline = cleanTimeline([
          { key: "receipt.create", label: "Tạo phiếu đặt hàng", tone: "info", at: rec.created_at, by: rec.creator?.name ?? null },
          { key: "receipt.approve", label: "Duyệt đặt hàng", tone: "info", at: rec.approved_at, by: rec.approver?.name ?? null },
          rec.status === "posted" ? { key: "receipt.post", label: "Nhập kho", tone: "success", at: rec.updated_at, by: rec.approver?.name ?? rec.creator?.name ?? null } : null,
        ]);
      }

      return {
        currentUser,
        detail: {
          type: "receipt",
          id: rec.id,
          code: rec.code,
          status: rec.status,
          createdAt: rec.created_at,
          creatorName: rec.creator?.name,
          creatorId: rec.created_by,
          supplierName: rec.supplier?.name,
          purposeOrNotes: rec.notes,
          invoiceImages: mergedInvoiceImages,
          items,
          linkedRequisitions,
          timeline,
          pdfUrl: `/api/receipts/${rec.id}/pdf`,
        },
      };
    }

    if (t === "issue" || t === "issues") {
      const { data: iss, error } = await supabase
        .from("issues")
        .select(
          "id, code, destination_type, status, notes, creator_id, invoice_images, vehicle_plate, driver_name, created_at, customer:customers(name, address, phone), zone:zones(name), sub_zone:sub_zones(name), creator:profiles(name), items:issue_items(id, sku_id, quantity, unit_price, skus(id, sku_code, price, images, products(name, images), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol))))",
        )
        .eq("id", id)
        .single();

      if (error || !iss) return { detail: null, currentUser, error: "Không tìm thấy phiếu xuất kho" };

      const items = (iss.items ?? []).map((it) => {
        const v = it.skus as {
          attributes?: unknown;
          unit?: string | null;
          units?: { name?: string | null; symbol?: string | null } | null;
          sku_attribute_values?: Array<{
            text_value?: string | null;
            legacy_text_value?: string | null;
            numeric_value?: number | null;
            units?: { symbol?: string | null } | null;
          }> | null;
          images?: string[] | null;
          products?: { name?: string | null; images?: string[] | null } | null;
        } | null;
        const unit = v?.units?.symbol || v?.units?.name || v?.unit || "—";
        const images = (v?.images && v.images.length > 0) ? v.images : (v?.products?.images ?? []);
        return {
          id: it.id,
          variantId: it.sku_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit,
          quantity: it.quantity,
          unitPrice: it.unit_price ? Number(it.unit_price) : null,
          images,
        };
      });

      let timeline: SlipTimelineEvent[] = [];
      if (auditLogs && auditLogs.length > 0) {
        timeline = auditLogs.map((a) => ({
          key: a.action,
          label: auditActionLabel(a.action),
          tone: auditActionTone(a.action),
          at: a.created_at,
          by: a.actor?.name ?? null,
        }));
      } else {
        timeline = cleanTimeline([
          { key: "issue.create", label: "Tạo phiếu xuất kho", tone: "info", at: iss.created_at, by: iss.creator?.name ?? null },
          iss.status === "posted" ? { key: "issue.post", label: "Xuất kho", tone: "success", at: iss.created_at, by: iss.creator?.name ?? null } : null,
        ]);
      }

      return {
        currentUser,
        detail: {
          type: "issue",
          id: iss.id,
          code: iss.code,
          status: iss.status,
          createdAt: iss.created_at,
          creatorName: iss.creator?.name,
          creatorId: iss.creator_id,
          destinationType: iss.destination_type,
          zoneName: formatZoneLabel(iss.zone?.name, iss.sub_zone?.name),
          customerName: iss.customer?.name,
          customerAddress: iss.customer?.address,
          customerPhone: iss.customer?.phone,
          purposeOrNotes: iss.notes,
          invoiceImages: iss.invoice_images ?? [],
          vehiclePlate: iss.vehicle_plate,
          driverName: iss.driver_name,
          items,
          timeline,
          pdfUrl: `/api/issues/${iss.id}/pdf`,
        },
      };
    }

    if (t.startsWith("exchange")) {
      const { data: ex, error } = await supabase
        .from("exchange_notes")
        .select(
          "id, code, linked_defect_id, status, rejection_reason, created_at, approved_at, issued_at, received_at, creator:profiles!exchange_notes_created_by_fkey(name), approver:profiles!exchange_notes_approved_by_fkey(name), issuer:profiles!exchange_notes_issued_by_fkey(name), receiver:profiles!exchange_notes_received_by_fkey(name), defect:defect_notes!exchange_notes_linked_defect_id_fkey(code, defect_note_items(id, sku_id, quantity, damage_detail, note, images, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol)))))",
        )
        .eq("id", id)
        .single();

      if (error || !ex) return { detail: null, currentUser, error: "Không tìm thấy phiếu đổi mới" };

      const d = ex.defect;
      const items = (d?.defect_note_items ?? []).map((it) => {
        const v = it.skus as {
          attributes?: unknown;
          unit?: string | null;
          units?: { name?: string | null; symbol?: string | null } | null;
          sku_attribute_values?: Array<{
            text_value?: string | null;
            legacy_text_value?: string | null;
            numeric_value?: number | null;
            units?: { symbol?: string | null } | null;
          }> | null;
          products?: { name?: string | null } | null;
        } | null;
        const unit = v?.units?.symbol || v?.units?.name || v?.unit || "—";
        return {
          id: it.id,
          variantId: it.sku_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit,
          quantity: it.quantity,
          damageDetail: it.damage_detail,
          images: it.images ?? [],
          note: it.note,
        };
      });

      let timeline: SlipTimelineEvent[] = [];
      if (auditLogs && auditLogs.length > 0) {
        timeline = auditLogs.map((a) => ({
          key: a.action,
          label: auditActionLabel(a.action),
          tone: auditActionTone(a.action),
          at: a.created_at,
          by: a.actor?.name ?? null,
          note: a.action === "exchange.reject" ? ex.rejection_reason : null,
        }));
      } else {
        timeline = cleanTimeline([
          { key: "exchange.create", label: "Tạo đổi mới", tone: "info", at: ex.created_at, by: ex.creator?.name },
          { key: "exchange.approve", label: "Duyệt đổi mới", tone: "info", at: ex.approved_at, by: ex.approver?.name },
          { key: "exchange.issue", label: "Cấp phát đổi mới", tone: "success", at: ex.issued_at, by: ex.issuer?.name },
          { key: "exchange.receive", label: "Nhận hàng", tone: "success", at: ex.received_at, by: ex.receiver?.name },
        ]);
      }

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
          "id, code, status, notes, repair_requested_at, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), location:stock_locations!defect_notes_source_location_id_fkey(name), items:defect_note_items(id, sku_id, quantity, damage_detail, note, images, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol))))",
        )
        .eq("id", id)
        .single();

      if (error || !def) return { detail: null, currentUser, error: "Không tìm thấy phiếu báo hỏng" };

      const items = (def.items ?? []).map((it) => {
        const v = it.skus as {
          attributes?: unknown;
          unit?: string | null;
          units?: { name?: string | null; symbol?: string | null } | null;
          sku_attribute_values?: Array<{
            text_value?: string | null;
            legacy_text_value?: string | null;
            numeric_value?: number | null;
            units?: { symbol?: string | null } | null;
          }> | null;
          products?: { name?: string | null } | null;
        } | null;
        const unit = v?.units?.symbol || v?.units?.name || v?.unit || "—";
        return {
          id: it.id,
          variantId: it.sku_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit,
          quantity: it.quantity,
          damageDetail: it.damage_detail,
          images: it.images ?? [],
          note: it.note,
        };
      });

      let timeline: SlipTimelineEvent[] = [];
      if (auditLogs && auditLogs.length > 0) {
        timeline = auditLogs.map((a) => ({
          key: a.action,
          label: auditActionLabel(a.action),
          tone: auditActionTone(a.action),
          at: a.created_at,
          by: a.actor?.name ?? null,
        }));
      } else {
        timeline = cleanTimeline([
          { key: "defect.create", label: "Báo hỏng vật tư", tone: "warning", at: def.created_at, by: def.reporter?.name },
          def.repair_requested_at ? { key: "defect.request_repair", label: "Yêu cầu sửa chữa", tone: "warning", at: def.repair_requested_at } : null,
        ]);
      }

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
          timeline,
          pdfUrl: `/api/defects/${def.id}/pdf`,
        },
      };
    }

    if (t.startsWith("liquidation")) {
      const { data: liq, error } = await supabase
        .from("liquidation_notes")
        .select(
          "id, code, status, notes, reason, created_at, creator:profiles!liquidation_notes_created_by_fkey(name), approver:profiles!liquidation_notes_approved_by_fkey(name), items:liquidation_items(id, quantity, proceeds, notes, method, unit_value, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol))))",
        )
        .eq("id", id)
        .single();

      if (error || !liq) return { detail: null, currentUser, error: "Không tìm thấy phiếu thanh lý" };

      const items = (liq.items ?? []).map((it) => {
        const v = it.skus as {
          attributes?: unknown;
          unit?: string | null;
          units?: { name?: string | null; symbol?: string | null } | null;
          sku_attribute_values?: Array<{
            text_value?: string | null;
            legacy_text_value?: string | null;
            numeric_value?: number | null;
            units?: { symbol?: string | null } | null;
          }> | null;
          products?: { name?: string | null } | null;
        } | null;
        const unit = v?.units?.symbol || v?.units?.name || v?.unit || "—";
        return {
          id: it.id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit,
          quantity: it.quantity,
          unitPrice: it.unit_value ? Number(it.unit_value) : it.proceeds ? Number(it.proceeds) : null,
          damageDetail: it.notes ?? it.method,
        };
      });

      let timeline: SlipTimelineEvent[] = [];
      if (auditLogs && auditLogs.length > 0) {
        timeline = auditLogs.map((a) => ({
          key: a.action,
          label: auditActionLabel(a.action),
          tone: auditActionTone(a.action),
          at: a.created_at,
          by: a.actor?.name ?? null,
        }));
      } else {
        timeline = cleanTimeline([
          { key: "liquidation.create", label: "Tạo phiếu thanh lý", tone: "info", at: liq.created_at, by: liq.creator?.name },
        ]);
      }

      return {
        currentUser,
        detail: {
          type: "liquidation",
          id: liq.id,
          code: liq.code,
          status: liq.status,
          createdAt: liq.created_at,
          creatorName: liq.creator?.name,
          purposeOrNotes: liq.notes ?? liq.reason,
          items,
          timeline,
          pdfUrl: `/api/liquidations/${liq.id}/pdf`,
        },
      };
    }

    if (t.startsWith("repair")) {
      const { data: rep, error } = await supabase
        .from("repair_orders")
        .select(
          "id, code, vendor, status, total_cost, sent_at, expected_return_at, created_at, items:repair_order_items(id, quantity, repair_detail, cost, outcome, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol))))",
        )
        .eq("id", id)
        .single();

      if (error || !rep) return { detail: null, currentUser, error: "Không tìm thấy phiếu sửa chữa" };

      const items = (rep.items ?? []).map((it) => {
        const v = it.skus as {
          attributes?: unknown;
          unit?: string | null;
          units?: { name?: string | null; symbol?: string | null } | null;
          sku_attribute_values?: Array<{
            text_value?: string | null;
            legacy_text_value?: string | null;
            numeric_value?: number | null;
            units?: { symbol?: string | null } | null;
          }> | null;
          products?: { name?: string | null } | null;
        } | null;
        const unit = v?.units?.symbol || v?.units?.name || v?.unit || "—";
        return {
          id: it.id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit,
          quantity: it.quantity,
          unitPrice: it.cost ? Number(it.cost) : null,
          damageDetail: it.repair_detail,
          note: it.outcome,
        };
      });

      let timeline: SlipTimelineEvent[] = [];
      if (auditLogs && auditLogs.length > 0) {
        timeline = auditLogs.map((a) => ({
          key: a.action,
          label: auditActionLabel(a.action),
          tone: auditActionTone(a.action),
          at: a.created_at,
          by: a.actor?.name ?? null,
        }));
      } else {
        timeline = cleanTimeline([
          { key: "repair.create", label: "Tạo phiếu sửa chữa", tone: "info", at: rep.created_at },
          rep.sent_at ? { key: "repair.send", label: "Đưa đi sửa chữa", tone: "warning", at: rep.sent_at } : null,
        ]);
      }

      return {
        currentUser,
        detail: {
          type: "repair",
          id: rep.id,
          code: rep.code,
          status: rep.status,
          createdAt: rep.created_at,
          supplierName: rep.vendor,
          purposeOrNotes: rep.total_cost ? `Tổng chi phí: ${rep.total_cost.toLocaleString("vi-VN")} đ` : undefined,
          items,
          timeline,
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
