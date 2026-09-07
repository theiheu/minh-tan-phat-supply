"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
} | null): string {
  if (variants?.attributes && typeof variants.attributes === "object" && !Array.isArray(variants.attributes)) {
    const values = Object.values(variants.attributes as Record<string, unknown>).filter(
      (v) => typeof v === "string" && v.length > 0,
    );
    if (values.length > 0) return values.join(" · ");
  }
  return variants?.unit ?? "—";
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

    const { data: auditLogs } = await supabase
      .from("audit_logs")
      .select("id, action, created_at, actor:profiles!audit_logs_actor_id_fkey(name)")
      .eq("entity_type", auditEntityType)
      .eq("entity_id", id)
      .order("created_at", { ascending: true });

    if (t === "requisition" || t === "requisitions") {
      const { data: req, error } = await supabase
        .from("requisitions")
        .select(
          "id, code, purpose, status, requisition_type, linked_defect_id, requester_id, created_at, approved_at, fulfilled_at, received_at, rejection_reason, fulfillment_notes, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name), approver:profiles!requisitions_approved_by_fkey(name), fulfiller:profiles!requisitions_fulfilled_by_fkey(name), receiver:profiles!requisitions_received_by_fkey(name), items:requisition_items(id, variant_id, quantity, variants(attributes, unit, products(name)))",
        )
        .eq("id", id)
        .single();

      if (error || !req) return { detail: null, currentUser, error: "Không tìm thấy phiếu yêu cầu" };

      // Lấy lịch sử trả lại vật tư (tổng đã trả theo variant — dùng cho form trả trong modal).
      const { data: returnEvents } = await supabase
        .from("requisition_returns")
        .select("id, created_at, returnedBy:profiles!requisition_returns_returned_by_fkey(name), items:requisition_return_items(variant_id, quantity, variants(attributes, unit, products(name)))")
        .eq("requisition_id", req.id)
        .order("created_at", { ascending: true });

      const returnedByVariant = new Map<string, number>();
      for (const ev of (returnEvents ?? []) as { items?: { variant_id?: string | null; quantity: number }[] }[]) {
        for (const it of ev.items ?? []) {
          if (it.variant_id) returnedByVariant.set(it.variant_id, (returnedByVariant.get(it.variant_id) ?? 0) + it.quantity);
        }
      }

      const items = (req.items ?? []).map((it) => {
        const v = it.variants as { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
        return {
          id: it.id,
          variantId: it.variant_id,
          productName: v?.products?.name ?? "Vật tư",
          variantLabel: variantLabelFor(v),
          unit: v?.unit,
          quantity: it.quantity,
          returned: it.variant_id ? (returnedByVariant.get(it.variant_id) ?? 0) : 0,
        };
      });

      // Lấy bằng chứng hỏng nếu là phiếu thay thế/đổi mới
      let defectEvidence: SlipDetailPayload["defectEvidence"] = null;
      if (req.requisition_type === "replacement" && req.linked_defect_id) {
        const [{ data: dnote }, { data: ditems }] = await Promise.all([
          supabase.from("defect_notes").select("code").eq("id", req.linked_defect_id).single(),
          supabase
            .from("defect_note_items")
            .select("id, quantity, damage_detail, images, variants(attributes, unit, products(name))")
            .eq("defect_note_id", req.linked_defect_id),
        ]);
        if (dnote) {
          defectEvidence = {
            code: dnote.code,
            items: (ditems ?? []).map((it) => {
              const v = it.variants as { unit?: string | null; products?: { name: string | null } | null } | null;
              return {
                id: it.id,
                productName: v?.products?.name ?? null,
                unit: v?.unit ?? null,
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
            variants?: { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
          }[];
        };
        const lines = (typed.items ?? []).map((it) => {
          const name = it.variants?.products?.name ?? "Vật tư";
          const label = variantLabelFor(it.variants ?? null);
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

      let timeline: SlipTimelineEvent[] = [];
      if (auditLogs && auditLogs.length > 0) {
        timeline = auditLogs
          .filter((a) => a.action !== "requisition.return")
          .map((a) => ({
            key: a.action,
            label: auditActionLabel(a.action),
            tone: auditActionTone(a.action),
            at: a.created_at,
            by: a.actor?.name ?? null,
            note: a.action === "requisition.reject" ? req.rejection_reason : null,
          }));
        timeline = [...timeline, ...returnMilestones].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
      } else {
        timeline = cleanTimeline([
          { key: "requisition.create", label: "Tạo phiếu", tone: "info", at: req.created_at, by: req.requester?.name },
          { key: "requisition.approve", label: "Duyệt phiếu", tone: "info", at: req.approved_at, by: req.approver?.name },
          { key: "requisition.fulfill", label: "Cấp phát", tone: "success", at: req.fulfilled_at, by: req.fulfiller?.name },
          { key: "requisition.receive", label: "Xác nhận nhận", tone: "success", at: req.received_at, by: req.receiver?.name },
          ...returnMilestones,
        ]).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
      }

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
          defectEvidence,
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
          "id, code, notes, status, invoice_images, linked_requisition_ids, created_at, approved_at, updated_at, supplier:suppliers!receipts_supplier_id_fkey(name), creator:profiles!receipts_created_by_fkey(name), approver:profiles!receipts_approved_by_fkey(name), items:receipt_items(id, variant_id, quantity, unit_cost, batch_no, expiry_date, variants(attributes, unit, products(name)))",
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

      // Lấy danh sách phiếu yêu cầu được auto cấp phát khi ghi nhận nhập kho
      let linkedRequisitions: SlipDetailPayload["linkedRequisitions"] = [];
      const linkedIds = rec.linked_requisition_ids ?? [];
      if (linkedIds.length > 0) {
        const { data: lReqs } = await supabase
          .from("requisitions")
          .select("id, code, purpose, status, requester:profiles!requisitions_requester_id_fkey(name)")
          .in("id", linkedIds)
          .order("created_at", { ascending: true });
        linkedRequisitions = (lReqs ?? []).map((rq) => ({
          id: rq.id,
          code: rq.code,
          requesterName: (rq.requester as { name?: string | null } | null)?.name ?? null,
          purpose: rq.purpose,
          status: rq.status,
        }));
      }

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
          supplierName: rec.supplier?.name,
          purposeOrNotes: rec.notes,
          invoiceImages: rec.invoice_images ?? [],
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
          "id, code, destination_type, status, notes, invoice_images, vehicle_plate, driver_name, created_at, customer:customers(name, address, phone), zone:zones(name), creator:profiles(name), items:issue_items(id, variant_id, quantity, unit_price, variants(attributes, unit, products(name)))",
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
          destinationType: iss.destination_type,
          zoneName: iss.zone?.name,
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
          "id, code, status, notes, reason, created_at, creator:profiles!liquidation_notes_created_by_fkey(name), approver:profiles!liquidation_notes_approved_by_fkey(name), items:liquidation_items(id, quantity, proceeds, notes, method, unit_value, variants(attributes, unit, products(name)))",
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
          "id, code, vendor, status, total_cost, sent_at, expected_return_at, created_at, items:repair_order_items(id, quantity, repair_detail, cost, outcome, variants(attributes, unit, products(name)))",
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
