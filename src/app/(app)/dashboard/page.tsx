import { ActivityHistory, type ActivityItem } from "@/components/dashboard/activity-history";
import {
  DashboardStatsData,
  DashboardStatsSection,
} from "@/components/dashboard/dashboard-stats-section";
import { RecentRequisitionsCard } from "@/components/dashboard/recent-requisitions-card";
import type { ModalDocumentItem } from "@/components/dashboard/stat-detail-dialog";
import { formatZoneLabel } from "@/lib/format-zone";
import { getCurrentProfile } from "@/lib/auth";
import {
  auditActionLabel,
  auditActionTone,
  auditEntityHref,
  auditEntityLabel,
  DEFECT_STATUS,
  EXCHANGE_STATUS,
  LIQUIDATION_STATUS,
  RECEIPT_STATUS,
  REQUISITION_STATUS,
  statusBadgeVariant,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { isPrivileged } from "@/lib/types";

async function loadAuditActivities(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ActivityItem[]> {
  const { data: rawAudits } = await supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, before, after, created_at, actor:profiles!audit_logs_actor_id_fkey(id, name, role)",
    )
    .order("created_at", { ascending: false })
    .limit(15);

  if (!rawAudits || rawAudits.length === 0) return [];

  const reqIds: string[] = [];
  const receiptIds: string[] = [];
  const issueIds: string[] = [];
  const exchangeIds: string[] = [];
  const defectIds: string[] = [];
  const repairIds: string[] = [];
  const liquidationIds: string[] = [];
  const stocktakeIds: string[] = [];

  for (const a of rawAudits) {
    if (!a.entity_id) continue;
    const t = (a.entity_type ?? "").toLowerCase();
    if (t === "requisition" || t === "requisitions") reqIds.push(a.entity_id);
    else if (t === "receipt" || t === "receipts") receiptIds.push(a.entity_id);
    else if (t === "issue" || t === "issues") issueIds.push(a.entity_id);
    else if (t.startsWith("exchange")) exchangeIds.push(a.entity_id);
    else if (t.startsWith("defect")) defectIds.push(a.entity_id);
    else if (t.startsWith("repair")) repairIds.push(a.entity_id);
    else if (t.startsWith("liquidation")) liquidationIds.push(a.entity_id);
    else if (t.startsWith("stocktake")) stocktakeIds.push(a.entity_id);
  }

  const queryPromises: PromiseLike<{ data: { id: string; code?: string; name?: string | null }[] | null }>[] = [];
  if (reqIds.length > 0) queryPromises.push(supabase.from("requisitions").select("id, code").in("id", reqIds));
  if (receiptIds.length > 0) queryPromises.push(supabase.from("receipts").select("id, code").in("id", receiptIds));
  if (issueIds.length > 0) queryPromises.push(supabase.from("issues").select("id, code").in("id", issueIds));
  if (exchangeIds.length > 0) queryPromises.push(supabase.from("exchange_notes").select("id, code").in("id", exchangeIds));
  if (defectIds.length > 0) queryPromises.push(supabase.from("defect_notes").select("id, code").in("id", defectIds));
  if (repairIds.length > 0) queryPromises.push(supabase.from("repair_orders").select("id, code").in("id", repairIds));
  if (liquidationIds.length > 0) queryPromises.push(supabase.from("liquidation_notes").select("id, code").in("id", liquidationIds));
  if (stocktakeIds.length > 0) queryPromises.push(supabase.from("stocktake_sessions").select("id, code, name").in("id", stocktakeIds));

  const results = await Promise.all(queryPromises);
  const codeMap = new Map<string, string>();
  for (const res of results) {
    for (const r of (res.data ?? []) as { id: string; code?: string; name?: string }[]) {
      codeMap.set(r.id, r.code || r.name || "Kiểm kê");
    }
  }

  return rawAudits.map((a): ActivityItem => {
    const actor = a.actor as { id?: string; name?: string; role?: string } | null;
    const code = a.entity_id ? codeMap.get(a.entity_id) ?? null : null;
    return {
      id: a.id,
      action: a.action,
      actionLabel: auditActionLabel(a.action),
      actionTone: auditActionTone(a.action),
      entityType: a.entity_type ?? "",
      entityTypeLabel: auditEntityLabel(a.entity_type, a.action),
      entityId: a.entity_id,
      entityCode: code,
      entityHref: auditEntityHref(a.entity_type, a.entity_id),
      actorName: actor?.name ?? "Hệ thống",
      actorRole: actor?.role ?? null,
      before: (a.before as Record<string, unknown>) ?? null,
      after: (a.after as Record<string, unknown>) ?? null,
      createdAt: a.created_at,
    };
  });
}

async function loadDashboard() {
  const supabase = await createClient();

  const [
    products,
    activeRequisitions,
    pendingReceipts,
    pendingExchanges,
    pendingLiquidations,
    pendingDefects,
    issuedExchanges,
    postedReceipts,
    activities,
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).is("deleted_at", null),

    // Các phiếu yêu cầu cần xử lý (chưa nhận: draft, pending, approved, issued) - tối đa 50 phiếu mới nhất
    supabase
      .from("requisitions")
      .select(
        "id, code, purpose, status, created_at, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name), sub_zone:sub_zones!requisitions_sub_zone_id_fkey(name)",
      )
      .in("status", ["draft", "pending", "approved", "issued"])
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("receipts")
      .select(
        "id, code, notes, status, created_at, supplier:suppliers!receipts_supplier_id_fkey(name), creator:profiles!receipts_created_by_fkey(name)",
      )
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("exchange_notes")
      .select(
        "id, code, status, created_at, requester:profiles!exchange_notes_created_by_fkey(name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("liquidation_notes")
      .select(
        "id, code, notes, status, created_at, creator:profiles!liquidation_notes_created_by_fkey(name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("defect_notes")
      .select(
        "id, code, notes, status, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), location:stock_locations!defect_notes_source_location_id_fkey(name)",
      )
      .eq("status", "staging")
      .order("created_at", { ascending: false })
      .limit(50),

    // Các phiếu đổi mới đã cấp chưa nhận
    supabase
      .from("exchange_notes")
      .select(
        "id, code, status, created_at, requester:profiles!exchange_notes_created_by_fkey(name)",
      )
      .eq("status", "issued")
      .order("created_at", { ascending: false })
      .limit(50),

    // Các phiếu nhập đã ghi sổ (50 phiếu gần nhất)
    supabase
      .from("receipts")
      .select(
        "id, code, notes, status, created_at, supplier:suppliers!receipts_supplier_id_fkey(name), creator:profiles!receipts_created_by_fkey(name)",
      )
      .eq("status", "posted")
      .order("created_at", { ascending: false })
      .limit(50),

    // Hoạt động gần đây
    loadAuditActivities(supabase),
  ]);

  const reqList = activeRequisitions.data ?? [];
  const pendingReqList = reqList.filter((r) => r.status === "pending" || r.status === "draft");
  const issuedReqList = reqList.filter((r) => r.status === "issued");

  // Gom nhóm danh sách phiếu chờ duyệt
  const pendingItems: ModalDocumentItem[] = [
    ...pendingReqList.map(
      (r): ModalDocumentItem => ({
        id: r.id,
        code: r.code,
        type: "requisition",
        typeLabel: "Phiếu yêu cầu",
        typeTone: "info",
        status: r.status,
        statusLabel: REQUISITION_STATUS[r.status] ?? r.status,
        statusVariant: statusBadgeVariant(r.status),
        href: `/requisitions/${r.id}`,
        createdAt: r.created_at,
        actorName: r.requester?.name,
        zoneName: formatZoneLabel(r.zone?.name, r.sub_zone?.name),
        purpose: r.purpose,
      }),
    ),
    ...(pendingReceipts.data ?? []).map(
      (r): ModalDocumentItem => ({
        id: r.id,
        code: r.code,
        type: "receipt",
        typeLabel: "Phiếu đặt hàng",
        typeTone: "info",
        status: r.status,
        statusLabel: RECEIPT_STATUS[r.status] ?? r.status,
        statusVariant: statusBadgeVariant(r.status),
        href: `/receipts/${r.id}`,
        createdAt: r.created_at,
        actorName: r.creator?.name ?? r.supplier?.name,
        zoneName: r.supplier?.name ? `NCC: ${r.supplier.name}` : null,
        purpose: r.notes,
      }),
    ),
    ...(pendingExchanges.data ?? []).map(
      (r): ModalDocumentItem => ({
        id: r.id,
        code: r.code,
        type: "exchange",
        typeLabel: "Phiếu đổi mới",
        typeTone: "info",
        status: r.status,
        statusLabel: EXCHANGE_STATUS[r.status] ?? r.status,
        statusVariant: statusBadgeVariant(r.status),
        href: `/defects/exchange/${r.id}`,
        createdAt: r.created_at,
        actorName: r.requester?.name,
        purpose: "Yêu cầu đổi mới vật tư",
      }),
    ),
    ...(pendingLiquidations.data ?? []).map(
      (r): ModalDocumentItem => ({
        id: r.id,
        code: r.code,
        type: "liquidation",
        typeLabel: "Phiếu thanh lý",
        typeTone: "warning",
        status: r.status,
        statusLabel: LIQUIDATION_STATUS[r.status] ?? r.status,
        statusVariant: statusBadgeVariant(r.status),
        href: "/liquidations",
        createdAt: r.created_at,
        actorName: r.creator?.name,
        purpose: r.notes,
      }),
    ),
    ...(pendingDefects.data ?? []).map(
      (r): ModalDocumentItem => ({
        id: r.id,
        code: r.code,
        type: "defect",
        typeLabel: "Phiếu báo hỏng",
        typeTone: "warning",
        status: r.status,
        statusLabel: DEFECT_STATUS[r.status] ?? r.status,
        statusVariant: statusBadgeVariant(r.status),
        href: "/defects",
        createdAt: r.created_at,
        actorName: r.reporter?.name,
        zoneName: r.location?.name,
        purpose: r.notes,
      }),
    ),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Gom nhóm danh sách phiếu đã cấp chưa nhận
  const issuedItems: ModalDocumentItem[] = [
    ...issuedReqList.map(
      (r): ModalDocumentItem => ({
        id: r.id,
        code: r.code,
        type: "requisition",
        typeLabel: "Phiếu yêu cầu",
        typeTone: "info",
        status: r.status,
        statusLabel: REQUISITION_STATUS[r.status] ?? r.status,
        statusVariant: statusBadgeVariant(r.status),
        href: `/requisitions/${r.id}`,
        createdAt: r.created_at,
        actorName: r.requester?.name,
        zoneName: formatZoneLabel(r.zone?.name, r.sub_zone?.name),
        purpose: r.purpose,
      }),
    ),
    ...(issuedExchanges.data ?? []).map(
      (r): ModalDocumentItem => ({
        id: r.id,
        code: r.code,
        type: "exchange",
        typeLabel: "Phiếu đổi mới",
        typeTone: "info",
        status: r.status,
        statusLabel: EXCHANGE_STATUS[r.status] ?? r.status,
        statusVariant: statusBadgeVariant(r.status),
        href: `/defects/exchange/${r.id}`,
        createdAt: r.created_at,
        actorName: r.requester?.name,
        purpose: "Đã cấp hàng đổi mới (chờ người nhận xác nhận)",
      }),
    ),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Gom nhóm danh sách phiếu nhập đã ghi sổ
  const receiptsItems: ModalDocumentItem[] = (postedReceipts.data ?? [])
    .map(
      (r): ModalDocumentItem => ({
        id: r.id,
        code: r.code,
        type: "receipt",
        typeLabel: "Phiếu nhập kho",
        typeTone: "success",
        status: r.status,
        statusLabel: RECEIPT_STATUS[r.status] ?? r.status,
        statusVariant: statusBadgeVariant(r.status),
        href: `/receipts/${r.id}`,
        createdAt: r.created_at,
        actorName: r.creator?.name ?? r.supplier?.name,
        zoneName: r.supplier?.name ? `NCC: ${r.supplier.name}` : null,
        purpose: r.notes,
      }),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const statsData: DashboardStatsData = {
    totalProducts: products.count ?? 0,
    pendingCount: pendingItems.length,
    pendingItems,
    issuedCount: issuedItems.length,
    issuedItems,
    receiptsCount: receiptsItems.length,
    receiptsItems,
  };

  return {
    statsData,
    recentRequisitions: reqList,
    totalPendingRequisitionsCount: reqList.length,
    activities,
  };
}

export default async function DashboardPage() {
  const [data, profile] = await Promise.all([loadDashboard(), getCurrentProfile()]);
  const isManager = isPrivileged(profile?.role);

  return (
    <div className="space-y-4 sm:space-y-6">
      <DashboardStatsSection data={data.statsData} />

      <div className="space-y-4 sm:space-y-6">
        <RecentRequisitionsCard
          items={data.recentRequisitions}
          totalCount={data.totalPendingRequisitionsCount}
        />
        <ActivityHistory activities={data.activities} isManager={isManager} />
      </div>
    </div>
  );
}
