"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isOwner, isSuperuser } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  adminDeleteDocSchema,
  adminOverrideMetaSchema,
  adminReopenDocSchema,
  type AdminDeleteDocInput,
  type AdminOverrideMetaInput,
  type AdminReopenDocInput,
} from "./schema";
import type {
  AdminDocKind,
  AdminDocumentFilters,
  AdminDocumentListItem,
  DocumentInspectResult,
} from "./types";

/** Tất cả các route cần revalidate khi thay đổi/xoá phiếu. */
const ROUTES_TO_REVALIDATE = [
  "/",
  "/dashboard",
  "/receipts",
  "/issues",
  "/requisitions",
  "/defects",
  "/defects/exchange",
  "/repairs",
  "/liquidations",
  "/stocktake",
  "/fuel",
  "/fuel/reports",
  "/transfers",
  "/assemblies",
  "/products",
  "/reports",
  "/admin/products",
  "/admin/documents",
  "/admin/audit-logs",
];

function revalidateAllDocRoutes() {
  for (const r of ROUTES_TO_REVALIDATE) {
    try {
      revalidatePath(r);
    } catch {
      // no-op in test environment
    }
  }
}

/** Đảm bảo tài khoản gọi action là Quản trị viên (Superuser hoặc Owner). */
async function requireAdminProfile() {
  const current = await requireProfile();
  if (!isSuperuser(current.role) && !isOwner(current.role)) {
    throw new Error("Bạn không có quyền thực hiện thao tác can thiệp quản trị viên");
  }
  return current;
}

/** Kiểm tra các phiếu con và quan hệ phụ thuộc trước khi xoá. */
export async function adminInspectDocAction(
  kind: AdminDocKind,
  id: string
): Promise<DocumentInspectResult> {
  await requireAdminProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_inspect_document_dependencies", {
    p_kind: kind,
    p_id: id,
  });

  if (error) {
    throw new Error(error.message || "Không thể kiểm tra quan hệ phụ thuộc của phiếu");
  }

  return data as unknown as DocumentInspectResult;
}

/** Xoá cứng (Hard Delete) phiếu khỏi database kèm đảo bút toán tồn kho. */
export async function adminDeleteDocAction(input: AdminDeleteDocInput) {
  const admin = await requireAdminProfile();
  const parsed = adminDeleteDocSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_delete_document", {
    p_kind: parsed.kind,
    p_id: parsed.id,
    p_cascade: parsed.cascade,
    p_reason: parsed.reason,
    p_by: admin.id,
  });

  if (error) {
    throw new Error(error.message || "Lỗi khi xoá phiếu");
  }

  revalidateAllDocRoutes();
  return { ok: true };
}

/** Mở lại (Reopen) phiếu đã ghi sổ về trạng thái sửa được. */
export async function adminReopenDocAction(input: AdminReopenDocInput) {
  const admin = await requireAdminProfile();
  const parsed = adminReopenDocSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_reopen_document", {
    p_kind: parsed.kind,
    p_id: parsed.id,
    p_reason: parsed.reason,
    p_by: admin.id,
  });

  if (error) {
    throw new Error(error.message || "Lỗi khi mở lại phiếu");
  }

  revalidateAllDocRoutes();
  return { ok: true };
}

/** Sửa đè trực tiếp thông tin nhạy cảm của phiếu (Ngày tạo, người tạo, ghi chú). */
export async function adminOverrideMetaAction(input: AdminOverrideMetaInput) {
  const admin = await requireAdminProfile();
  const parsed = adminOverrideMetaSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_override_document_meta", {
    p_kind: parsed.kind,
    p_id: parsed.id,
    p_created_at: parsed.createdAt ?? null,
    p_actor_id: parsed.actorId ?? null,
    p_notes: parsed.notes ?? null,
    p_reason: parsed.reason,
    p_by: admin.id,
  });

  if (error) {
    throw new Error(error.message || "Lỗi khi sửa siêu dữ liệu phiếu");
  }

  revalidateAllDocRoutes();
  return { ok: true };
}

/** Lấy danh sách tổng hợp tất cả các phiếu trong toàn hệ thống phục vụ Admin Master Hub. */
export async function adminGetMasterDocumentsAction(filters?: AdminDocumentFilters): Promise<{
  data: AdminDocumentListItem[];
  total: number;
}> {
  await requireAdminProfile();
  const supabase = createAdminClient();

  const page = Math.max(1, Number(filters?.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters?.pageSize ?? 25) || 25));
  const q = filters?.q?.trim().toUpperCase() || "";
  const filterKind = filters?.kind || "all";

  const allItems: AdminDocumentListItem[] = [];

  // Helper fetch function
  const fetchReceipts = async () => {
    let query = supabase
      .from("receipts")
      .select("id, code, status, created_at, created_by, notes, supplier:suppliers(name), creator:profiles!receipts_created_by_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) query = query.ilike("code", `%${q}%`);
    const { data } = await query;
    return (data || []).map((r) => ({
      id: r.id,
      kind: "receipt" as AdminDocKind,
      kindLabel: "Phiếu nhập kho",
      code: r.code,
      status: r.status,
      statusLabel: r.status === "posted" ? "Đã ghi sổ" : r.status === "approved" ? "Đã duyệt" : r.status === "cancelled" ? "Đã huỷ" : "Nháp",
      createdAt: r.created_at,
      creatorName: (r.creator as { name?: string } | null)?.name ?? null,
      zoneOrPartner: (r.supplier as { name?: string } | null)?.name ?? null,
      summary: r.notes,
      canReopen: r.status === "posted",
    }));
  };

  const fetchIssues = async () => {
    let query = supabase
      .from("issues")
      .select("id, code, status, created_at, creator_id, notes, zone:zones(name), customer:customers(name), creator:profiles!issues_creator_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) query = query.ilike("code", `%${q}%`);
    const { data } = await query;
    return (data || []).map((i) => ({
      id: i.id,
      kind: "issue" as AdminDocKind,
      kindLabel: "Phiếu xuất kho",
      code: i.code,
      status: i.status,
      statusLabel: i.status === "posted" ? "Đã ghi sổ" : "Nháp",
      createdAt: i.created_at,
      creatorName: (i.creator as { name?: string } | null)?.name ?? null,
      zoneOrPartner: (i.zone as { name?: string } | null)?.name ?? (i.customer as { name?: string } | null)?.name ?? null,
      summary: i.notes,
      canReopen: i.status === "posted",
    }));
  };

  const fetchRequisitions = async () => {
    let query = supabase
      .from("requisitions")
      .select("id, code, status, created_at, requester_id, purpose, zone:zones(name), requester:profiles!requisitions_requester_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) query = query.ilike("code", `%${q}%`);
    const { data } = await query;
    return (data || []).map((req) => ({
      id: req.id,
      kind: "requisition" as AdminDocKind,
      kindLabel: "Phiếu yêu cầu",
      code: req.code,
      status: req.status,
      statusLabel: req.status === "received" ? "Đã nhận" : req.status === "issued" ? "Đã cấp" : req.status === "approved" ? "Đã duyệt" : req.status === "rejected" ? "Từ chối" : req.status === "cancelled" ? "Đã huỷ" : "Chờ duyệt",
      createdAt: req.created_at,
      creatorName: (req.requester as { name?: string } | null)?.name ?? null,
      zoneOrPartner: (req.zone as { name?: string } | null)?.name ?? null,
      summary: req.purpose,
      canReopen: req.status === "issued" || req.status === "received",
    }));
  };

  const fetchDefects = async () => {
    let query = supabase
      .from("defect_notes")
      .select("id, code, status, created_at, reported_by, notes, reporter:profiles!defect_notes_reported_by_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) query = query.ilike("code", `%${q}%`);
    const { data } = await query;
    return (data || []).map((d) => ({
      id: d.id,
      kind: "defect" as AdminDocKind,
      kindLabel: "Phiếu báo hỏng",
      code: d.code,
      status: d.status,
      statusLabel: d.status === "staging" ? "Chờ xử lý" : d.status === "in_repair" ? "Đang sửa" : d.status === "returned" ? "Đã hoàn tất" : d.status === "liquidated" ? "Đã thanh lý" : "Đã huỷ",
      createdAt: d.created_at,
      creatorName: (d.reporter as { name?: string } | null)?.name ?? null,
      zoneOrPartner: null,
      summary: d.notes,
      canReopen: false,
    }));
  };

  const fetchRepairs = async () => {
    let query = supabase
      .from("repair_orders")
      .select("id, code, status, created_at, created_by, notes, creator:profiles!repair_orders_created_by_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) query = query.ilike("code", `%${q}%`);
    const { data } = await query;
    return (data || []).map((r) => ({
      id: r.id,
      kind: "repair" as AdminDocKind,
      kindLabel: "Phiếu sửa chữa",
      code: r.code,
      status: r.status,
      statusLabel: r.status === "returned" ? "Hoàn tất" : r.status === "in_repair" ? "Đang sửa" : "Đã huỷ",
      createdAt: r.created_at,
      creatorName: (r.creator as { name?: string } | null)?.name ?? null,
      zoneOrPartner: null,
      summary: r.notes,
      canReopen: r.status === "returned",
    }));
  };

  const fetchExchanges = async () => {
    let query = supabase
      .from("exchange_notes")
      .select("id, code, status, created_at, created_by, creator:profiles!exchange_notes_created_by_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) query = query.ilike("code", `%${q}%`);
    const { data } = await query;
    return (data || []).map((e) => ({
      id: e.id,
      kind: "exchange" as AdminDocKind,
      kindLabel: "Phiếu đổi hàng lỗi",
      code: e.code,
      status: e.status,
      statusLabel: e.status === "received" ? "Đã nhận" : e.status === "issued" ? "Đã cấp" : e.status === "approved" ? "Đã duyệt" : e.status === "rejected" ? "Từ chối" : "Chờ duyệt",
      createdAt: e.created_at,
      creatorName: (e.creator as { name?: string } | null)?.name ?? null,
      zoneOrPartner: null,
      summary: null,
      canReopen: e.status === "issued" || e.status === "received",
    }));
  };

  const fetchLiquidations = async () => {
    let query = supabase
      .from("liquidation_notes")
      .select("id, code, status, created_at, created_by, notes, creator:profiles!liquidation_notes_created_by_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) query = query.ilike("code", `%${q}%`);
    const { data } = await query;
    return (data || []).map((l) => ({
      id: l.id,
      kind: "liquidation" as AdminDocKind,
      kindLabel: "Phiếu thanh lý",
      code: l.code,
      status: l.status,
      statusLabel: l.status === "completed" ? "Đã thanh lý" : l.status === "approved" ? "Đã duyệt" : l.status === "rejected" ? "Từ chối" : "Chờ duyệt",
      createdAt: l.created_at,
      creatorName: (l.creator as { name?: string } | null)?.name ?? null,
      zoneOrPartner: null,
      summary: l.notes,
      canReopen: l.status === "completed",
    }));
  };

  const fetchStocktakes = async () => {
    let query = supabase
      .from("stocktake_sessions")
      .select("id, code, status, created_at, created_by, notes, location:stock_locations(name), creator:profiles!stocktake_sessions_created_by_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) query = query.ilike("code", `%${q}%`);
    const { data } = await query;
    return (data || []).map((s) => ({
      id: s.id,
      kind: "stocktake" as AdminDocKind,
      kindLabel: "Phiếu kiểm kê",
      code: s.code,
      status: s.status,
      statusLabel: s.status === "posted" ? "Đã chốt sổ" : s.status === "cancelled" ? "Đã huỷ" : "Đang kiểm kê",
      createdAt: s.created_at,
      creatorName: (s.creator as { name?: string } | null)?.name ?? null,
      zoneOrPartner: (s.location as { name?: string } | null)?.name ?? null,
      summary: s.notes,
      canReopen: s.status === "posted",
    }));
  };

  const fetchFuelReceipts = async () => {
    let query = supabase
      .from("fuel_receipts")
      .select("id, code, status, created_at, received_by, quantity, notes, fuel_type:fuel_types(name), supplier:suppliers(name), receiver:profiles!fuel_receipts_received_by_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) query = query.ilike("code", `%${q}%`);
    const { data } = await query;
    return (data || []).map((fr) => ({
      id: fr.id,
      kind: "fuel_receipt" as AdminDocKind,
      kindLabel: "Phiếu nhập dầu",
      code: fr.code,
      status: fr.status,
      statusLabel: fr.status === "cancelled" ? "Đã huỷ" : "Hoàn thành",
      createdAt: fr.created_at,
      creatorName: (fr.receiver as { name?: string } | null)?.name ?? null,
      zoneOrPartner: (fr.supplier as { name?: string } | null)?.name ?? (fr.fuel_type as { name?: string } | null)?.name ?? null,
      summary: `${fr.quantity} Lít${fr.notes ? " - " + fr.notes : ""}`,
      canReopen: false,
    }));
  };

  const fetchFuelDispenses = async () => {
    let query = supabase
      .from("fuel_dispenses")
      .select("id, code, status, created_at, dispenser_id, quantity, notes, vehicle:vehicles(code), fuel_type:fuel_types(name), zone:zones(name), dispenser:profiles!fuel_dispenses_dispenser_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (q) query = query.ilike("code", `%${q}%`);
    const { data } = await query;
    return (data || []).map((fd) => ({
      id: fd.id,
      kind: "fuel_dispense" as AdminDocKind,
      kindLabel: "Phiếu cấp phát dầu",
      code: fd.code,
      status: fd.status,
      statusLabel: fd.status === "cancelled" ? "Đã huỷ" : "Hoàn thành",
      createdAt: fd.created_at,
      creatorName: (fd.dispenser as { name?: string } | null)?.name ?? null,
      zoneOrPartner: (fd.vehicle as { code?: string } | null)?.code ?? (fd.zone as { name?: string } | null)?.name ?? null,
      summary: `${fd.quantity} Lít${fd.notes ? " - " + fd.notes : ""}`,
      canReopen: false,
    }));
  };

  const tasks: Promise<AdminDocumentListItem[]>[] = [];
  if (filterKind === "all" || filterKind === "receipt") tasks.push(fetchReceipts());
  if (filterKind === "all" || filterKind === "issue") tasks.push(fetchIssues());
  if (filterKind === "all" || filterKind === "requisition") tasks.push(fetchRequisitions());
  if (filterKind === "all" || filterKind === "defect") tasks.push(fetchDefects());
  if (filterKind === "all" || filterKind === "repair") tasks.push(fetchRepairs());
  if (filterKind === "all" || filterKind === "exchange") tasks.push(fetchExchanges());
  if (filterKind === "all" || filterKind === "liquidation") tasks.push(fetchLiquidations());
  if (filterKind === "all" || filterKind === "stocktake") tasks.push(fetchStocktakes());
  if (filterKind === "all" || filterKind === "fuel_receipt") tasks.push(fetchFuelReceipts());
  if (filterKind === "all" || filterKind === "fuel_dispense") tasks.push(fetchFuelDispenses());

  const results = await Promise.all(tasks);
  for (const list of results) {
    allItems.push(...list);
  }

  // Sắp xếp theo ngày tạo mới nhất
  allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const paginated = allItems.slice((page - 1) * pageSize, page * pageSize);
  return { data: paginated, total: allItems.length };
}

/** Lấy lịch sử can thiệp Admin trong bảng audit_logs. */
export async function adminGetAuditLogsAction(entityId?: string, limit = 20) {
  await requireAdminProfile();
  const supabase = createAdminClient();

  let query = supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, before, after, created_at, actor:profiles!audit_logs_actor_id_fkey(name, username)")
    .ilike("action", "admin.%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (entityId) {
    query = query.eq("entity_id", entityId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Tương thích ngược với các file cũ import từ dev-tools */
export async function devReopenDoc(kind: AdminDocKind, id: string) {
  return adminReopenDocAction({ kind, id, reason: "Reopen from DevDocTools" });
}

export async function devDeleteDoc(kind: AdminDocKind, id: string) {
  return adminDeleteDocAction({ kind, id, cascade: true, reason: "Delete from DevDocTools" });
}

export const reopenDocumentDevAction = devReopenDoc;
export const deleteDocumentDevAction = devDeleteDoc;
