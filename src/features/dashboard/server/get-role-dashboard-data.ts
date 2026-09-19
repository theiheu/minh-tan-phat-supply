import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { formatZoneLabel } from "@/lib/format-zone";
import {
  auditActionLabel,
  auditActionTone,
  auditEntityHref,
  auditEntityLabel,
  DEFECT_STATUS,
  EXCHANGE_STATUS,
  ISSUE_STATUS,
  LIQUIDATION_STATUS,
  RECEIPT_STATUS,
  REPAIR_STATUS,
  REQUISITION_STATUS,
  STOCKTAKE_STATUS,
} from "@/lib/labels";
import type { TaskItem } from "@/components/dashboard/shared/pending-tasks-card";
import type { LowStockItem } from "@/components/dashboard/shared/low-stock-alert-card";
import type { ActivityItem } from "@/components/dashboard/activity-history";

// ==========================================
// 1. EXECUTIVE DATA (Owner, Superuser)
// ==========================================
export interface ExecutiveDashboardData {
  metrics: {
    totalProducts: number;
    pendingApprovalsCount: number;
    monthIssuesCount: number;
    weekFuelDispensesCount: number;
  };
  pendingLiquidations: TaskItem[];
  pendingStocktakes: TaskItem[];
  lowStockItems: LowStockItem[];
  recentActivities: ActivityItem[];
}

export async function getExecutiveDashboardData(
  _profile: Profile
): Promise<ExecutiveDashboardData> {
  const supabase = await createClient();

  const [
    productsCount,
    liquidations,
    stocktakes,
    lowStockBalances,
    monthIssues,
    weekFuel,
    rawAudits,
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("liquidation_notes")
      .select("id, code, notes, reason, status, created_at, creator:profiles!liquidation_notes_created_by_fkey(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("stocktake_sessions")
      .select("id, code, name, status, created_at, location:stock_locations!stocktake_sessions_location_id_fkey(name)")
      .in("status", ["draft"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("stock_balances")
      .select("id, quantity, sku:skus!stock_balances_sku_id_fkey(id, code, min_stock, base_unit, product:products!skus_product_id_fkey(name))")
      .order("quantity", { ascending: true })
      .limit(30),
    supabase
      .from("issues")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase
      .from("fuel_dispenses")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
    loadAuditActivities(supabase),
  ]);

  const pendingLiqTasks: TaskItem[] = (liquidations.data ?? []).map((l): TaskItem => ({
    id: l.id,
    code: l.code,
    type: "liquidation",
    typeLabel: "Phiếu thanh lý",
    actorName: (l.creator as { name?: string })?.name ?? "Nhân viên",
    description: l.notes || l.reason || "Thanh lý phế liệu",
    status: l.status,
    statusLabel: LIQUIDATION_STATUS[l.status] ?? l.status,
    createdAt: l.created_at,
    href: "/liquidations",
  }));

  const pendingStocktakeTasks: TaskItem[] = (stocktakes.data ?? []).map((s): TaskItem => ({
    id: s.id,
    code: s.code || s.name || "Kiểm kê",
    type: "stocktake",
    typeLabel: "Phiên kiểm kê",
    locationOrZone: (s.location as { name?: string })?.name,
    description: s.name,
    status: s.status,
    statusLabel: STOCKTAKE_STATUS[s.status] ?? s.status,
    createdAt: s.created_at,
    href: "/stocktake",
  }));

  // Low stock mapping
  const lowStockItems: LowStockItem[] = [];
  for (const b of lowStockBalances.data ?? []) {
    const sku = b.sku as unknown as { id: string; code: string; min_stock: number; base_unit: string; product: { name: string } } | null;
    if (sku && (sku.min_stock ?? 0) > 0 && Number(b.quantity) <= Number(sku.min_stock)) {
      lowStockItems.push({
        id: b.id,
        skuCode: sku.code,
        productName: sku.product?.name || sku.code,
        currentStock: Number(b.quantity),
        minStock: Number(sku.min_stock),
        unit: sku.base_unit || "Cái",
      });
    }
  }

  return {
    metrics: {
      totalProducts: productsCount.count ?? 0,
      pendingApprovalsCount: pendingLiqTasks.length + pendingStocktakeTasks.length,
      monthIssuesCount: monthIssues.count ?? 0,
      weekFuelDispensesCount: weekFuel.count ?? 0,
    },
    pendingLiquidations: pendingLiqTasks,
    pendingStocktakes: pendingStocktakeTasks,
    lowStockItems,
    recentActivities: rawAudits,
  };
}

// ==========================================
// 2. ACCOUNTANT DATA (Accountant)
// ==========================================
export interface AccountantDashboardData {
  metrics: {
    draftReceiptsCount: number;
    pendingLiquidationsCount: number;
    monthIssuesCount: number;
    pendingStocktakesCount: number;
  };
  pendingReceipts: TaskItem[];
  recentIssues: TaskItem[];
  pendingLiquidations: TaskItem[];
}

export async function getAccountantDashboardData(
  _profile: Profile
): Promise<AccountantDashboardData> {
  const supabase = await createClient();

  const [draftReceipts, monthIssues, liquidations, stocktakes] = await Promise.all([
    supabase
      .from("receipts")
      .select("id, code, notes, status, created_at, supplier:suppliers!receipts_supplier_id_fkey(name), creator:profiles!receipts_created_by_fkey(name)")
      .in("status", ["draft"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("issues")
      .select("id, code, notes, status, created_at, zone:zones!issues_zone_id_fkey(name), customer:customers!issues_customer_id_fkey(name), creator:profiles!issues_created_by_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("liquidation_notes")
      .select("id, code, notes, reason, status, created_at, creator:profiles!liquidation_notes_created_by_fkey(name)")
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("stocktake_sessions")
      .select("id, code, name, status, created_at, location:stock_locations!stocktake_sessions_location_id_fkey(name)")
      .eq("status", "draft")
      .limit(20),
  ]);

  const receiptTasks: TaskItem[] = (draftReceipts.data ?? []).map((r): TaskItem => ({
    id: r.id,
    code: r.code,
    type: "receipt",
    typeLabel: "Phiếu nhập kho",
    actorName: (r.supplier as { name?: string })?.name ? `NCC: ${(r.supplier as { name?: string }).name}` : (r.creator as { name?: string })?.name,
    description: r.notes || "Nhập hàng từ nhà cung cấp",
    status: r.status,
    statusLabel: RECEIPT_STATUS[r.status] ?? r.status,
    createdAt: r.created_at,
    href: `/receipts/${r.id}`,
  }));

  const issueTasks: TaskItem[] = (monthIssues.data ?? []).map((i): TaskItem => ({
    id: i.id,
    code: i.code,
    type: "issue",
    typeLabel: "Phiếu xuất kho",
    actorName: (i.customer as { name?: string })?.name ? `Khách: ${(i.customer as { name?: string }).name}` : (i.zone as { name?: string })?.name,
    description: i.notes || "Xuất vật tư trang trại",
    status: i.status,
    statusLabel: ISSUE_STATUS[i.status] ?? i.status,
    createdAt: i.created_at,
    href: `/issues/${i.id}`,
  }));

  const liqTasks: TaskItem[] = (liquidations.data ?? []).map((l): TaskItem => ({
    id: l.id,
    code: l.code,
    type: "liquidation",
    typeLabel: "Phiếu thanh lý",
    actorName: (l.creator as { name?: string })?.name ?? "Nhân viên",
    description: l.notes || l.reason || "Thanh lý phế liệu",
    status: l.status,
    statusLabel: LIQUIDATION_STATUS[l.status] ?? l.status,
    createdAt: l.created_at,
    href: "/liquidations",
  }));

  return {
    metrics: {
      draftReceiptsCount: receiptTasks.length,
      pendingLiquidationsCount: liqTasks.length,
      monthIssuesCount: issueTasks.length,
      pendingStocktakesCount: (stocktakes.data ?? []).length,
    },
    pendingReceipts: receiptTasks,
    recentIssues: issueTasks,
    pendingLiquidations: liqTasks,
  };
}

// ==========================================
// 3. WAREHOUSE DATA (Warehouse Manager / Stockkeeper)
// ==========================================
export interface WarehouseDashboardData {
  metrics: {
    approvedRequisitionsCount: number;
    draftReceiptsCount: number;
    pendingExchangesCount: number;
    lowStockCount: number;
  };
  fulfillmentQueue: TaskItem[];
  pendingReceipts: TaskItem[];
  pendingExchanges: TaskItem[];
  lowStockItems: LowStockItem[];
}

export async function getWarehouseDashboardData(
  _profile: Profile
): Promise<WarehouseDashboardData> {
  const supabase = await createClient();

  const [approvedReqs, draftReceipts, pendingExchanges, lowStockBalances] = await Promise.all([
    supabase
      .from("requisitions")
      .select("id, code, purpose, status, created_at, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name), sub_zone:sub_zones!requisitions_sub_zone_id_fkey(name)")
      .in("status", ["approved", "pending"])
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("receipts")
      .select("id, code, notes, status, created_at, supplier:suppliers!receipts_supplier_id_fkey(name), creator:profiles!receipts_created_by_fkey(name)")
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("exchange_notes")
      .select("id, code, status, created_at, requester:profiles!exchange_notes_created_by_fkey(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("stock_balances")
      .select("id, quantity, sku:skus!stock_balances_sku_id_fkey(id, code, min_stock, base_unit, product:products!skus_product_id_fkey(name))")
      .order("quantity", { ascending: true })
      .limit(30),
  ]);

  const reqTasks: TaskItem[] = (approvedReqs.data ?? []).map((r): TaskItem => ({
    id: r.id,
    code: r.code,
    type: "requisition",
    typeLabel: "Phiếu yêu cầu",
    actorName: (r.requester as { name?: string })?.name,
    locationOrZone: formatZoneLabel((r.zone as { name?: string })?.name, (r.sub_zone as { name?: string })?.name),
    description: r.purpose,
    status: r.status,
    statusLabel: REQUISITION_STATUS[r.status] ?? r.status,
    createdAt: r.created_at,
    href: `/requisitions/${r.id}`,
  }));

  const receiptTasks: TaskItem[] = (draftReceipts.data ?? []).map((r): TaskItem => ({
    id: r.id,
    code: r.code,
    type: "receipt",
    typeLabel: "Phiếu nhập kho",
    actorName: (r.supplier as { name?: string })?.name ? `NCC: ${(r.supplier as { name?: string }).name}` : (r.creator as { name?: string })?.name,
    description: r.notes || "Hàng mới về",
    status: r.status,
    statusLabel: RECEIPT_STATUS[r.status] ?? r.status,
    createdAt: r.created_at,
    href: `/receipts/${r.id}`,
  }));

  const exchangeTasks: TaskItem[] = (pendingExchanges.data ?? []).map((e): TaskItem => ({
    id: e.id,
    code: e.code,
    type: "exchange",
    typeLabel: "Đổi 1-1 cấp tốc",
    actorName: (e.requester as { name?: string })?.name,
    description: "Yêu cầu cấp đổi mới vật tư hỏng",
    status: e.status,
    statusLabel: EXCHANGE_STATUS[e.status] ?? e.status,
    createdAt: e.created_at,
    href: `/defects/exchange/${e.id}`,
  }));

  const lowStockItems: LowStockItem[] = [];
  for (const b of lowStockBalances.data ?? []) {
    const sku = b.sku as unknown as { id: string; code: string; min_stock: number; base_unit: string; product: { name: string } } | null;
    if (sku && (sku.min_stock ?? 0) > 0 && Number(b.quantity) <= Number(sku.min_stock)) {
      lowStockItems.push({
        id: b.id,
        skuCode: sku.code,
        productName: sku.product?.name || sku.code,
        currentStock: Number(b.quantity),
        minStock: Number(sku.min_stock),
        unit: sku.base_unit || "Cái",
      });
    }
  }

  return {
    metrics: {
      approvedRequisitionsCount: reqTasks.filter(t => t.status === "approved").length,
      draftReceiptsCount: receiptTasks.length,
      pendingExchangesCount: exchangeTasks.length,
      lowStockCount: lowStockItems.length,
    },
    fulfillmentQueue: reqTasks,
    pendingReceipts: receiptTasks,
    pendingExchanges: exchangeTasks,
    lowStockItems,
  };
}

// ==========================================
// 4. TECHNICIAN DATA (Technician / Zone Lead)
// ==========================================
export interface TechnicianDashboardData {
  metrics: {
    pendingApprovalReqsCount: number;
    activeRepairsCount: number;
    stagingDefectsCount: number;
    borrowedToolsCount: number;
  };
  pendingRequisitions: TaskItem[];
  activeRepairs: TaskItem[];
  stagingDefects: TaskItem[];
}

export async function getTechnicianDashboardData(
  _profile: Profile
): Promise<TechnicianDashboardData> {
  const supabase = await createClient();

  const [pendingReqs, repairs, defects, toolBorrowings] = await Promise.all([
    supabase
      .from("requisitions")
      .select("id, code, purpose, status, created_at, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name), sub_zone:sub_zones!requisitions_sub_zone_id_fkey(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("repair_orders")
      .select("id, code, vendor, status, notes, created_at")
      .eq("status", "in_repair")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("defect_notes")
      .select("id, code, notes, status, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), location:stock_locations!defect_notes_source_location_id_fkey(name)")
      .eq("status", "staging")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("tool_borrowings")
      .select("*", { count: "exact", head: true })
      .eq("status", "borrowed"),
  ]);

  const reqTasks: TaskItem[] = (pendingReqs.data ?? []).map((r): TaskItem => ({
    id: r.id,
    code: r.code,
    type: "requisition",
    typeLabel: "Phiếu xin cấp vật tư",
    actorName: (r.requester as { name?: string })?.name,
    locationOrZone: formatZoneLabel((r.zone as { name?: string })?.name, (r.sub_zone as { name?: string })?.name),
    description: r.purpose,
    status: r.status,
    statusLabel: REQUISITION_STATUS[r.status] ?? r.status,
    createdAt: r.created_at,
    href: `/requisitions/${r.id}`,
  }));

  const repairTasks: TaskItem[] = (repairs.data ?? []).map((rep): TaskItem => ({
    id: rep.id,
    code: rep.code,
    type: "repair",
    typeLabel: "Đơn gửi sửa chữa",
    actorName: rep.vendor ? `Xưởng: ${rep.vendor}` : "Xưởng cơ điện ngoài",
    description: rep.notes || "Quấn motor / sửa chữa cơ khí",
    status: rep.status,
    statusLabel: REPAIR_STATUS[rep.status] ?? rep.status,
    createdAt: rep.created_at,
    href: "/repairs",
  }));

  const defectTasks: TaskItem[] = (defects.data ?? []).map((d): TaskItem => ({
    id: d.id,
    code: d.code,
    type: "defect",
    typeLabel: "Phiếu báo hỏng",
    actorName: (d.reporter as { name?: string })?.name,
    locationOrZone: (d.location as { name?: string })?.name,
    description: d.notes || "Thiết bị hỏng cần kiểm tra",
    status: d.status,
    statusLabel: DEFECT_STATUS[d.status] ?? d.status,
    createdAt: d.created_at,
    href: "/defects",
  }));

  return {
    metrics: {
      pendingApprovalReqsCount: reqTasks.length,
      activeRepairsCount: repairTasks.length,
      stagingDefectsCount: defectTasks.length,
      borrowedToolsCount: toolBorrowings.count ?? 0,
    },
    pendingRequisitions: reqTasks,
    activeRepairs: repairTasks,
    stagingDefects: defectTasks,
  };
}

// ==========================================
// 5. REQUESTER DATA (Field Worker / Requester)
// ==========================================
export interface RequesterDashboardData {
  metrics: {
    myPendingCount: number;
    readyToReceiveCount: number;
    myBorrowedToolsCount: number;
  };
  readyToReceiveList: TaskItem[];
  myRecentRequisitions: TaskItem[];
  myBorrowedTools: TaskItem[];
}

export async function getRequesterDashboardData(
  profile: Profile
): Promise<RequesterDashboardData> {
  const supabase = await createClient();

  const [myRequisitions, myTools] = await Promise.all([
    supabase
      .from("requisitions")
      .select("id, code, purpose, status, created_at, zone:zones!requisitions_zone_id_fkey(name), sub_zone:sub_zones!requisitions_sub_zone_id_fkey(name)")
      .eq("requester_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("tool_borrowings")
      .select("id, code, expected_return_date, status, created_at")
      .eq("borrower_id", profile.id)
      .eq("status", "borrowed")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const allMyReqs = myRequisitions.data ?? [];
  const readyToReceive = allMyReqs.filter(r => r.status === "issued");
  const pendingReqs = allMyReqs.filter(r => r.status === "pending" || r.status === "draft");

  const readyTasks: TaskItem[] = readyToReceive.map((r): TaskItem => ({
    id: r.id,
    code: r.code,
    type: "requisition",
    typeLabel: "Phiếu yêu cầu",
    locationOrZone: formatZoneLabel((r.zone as { name?: string })?.name, (r.sub_zone as { name?: string })?.name),
    description: r.purpose || "Đã xuất hàng - Vui lòng nhận vật tư",
    status: r.status,
    statusLabel: "Đã xuất kho (Chờ nhận)",
    createdAt: r.created_at,
    href: `/requisitions/${r.id}`,
    highlightAction: {
      label: "Xem & Nhận hàng",
      href: `/requisitions/${r.id}`,
      variant: "default",
    },
  }));

  const recentTasks: TaskItem[] = allMyReqs.map((r): TaskItem => ({
    id: r.id,
    code: r.code,
    type: "requisition",
    typeLabel: "Phiếu yêu cầu",
    locationOrZone: formatZoneLabel((r.zone as { name?: string })?.name, (r.sub_zone as { name?: string })?.name),
    description: r.purpose,
    status: r.status,
    statusLabel: REQUISITION_STATUS[r.status] ?? r.status,
    createdAt: r.created_at,
    href: `/requisitions/${r.id}`,
  }));

  const toolTasks: TaskItem[] = (myTools.data ?? []).map((t): TaskItem => ({
    id: t.id,
    code: t.code,
    type: "tool",
    typeLabel: "Mượn dụng cụ",
    description: t.expected_return_date ? `Hạn trả: ${new Date(t.expected_return_date).toLocaleDateString("vi-VN")}` : "Đang mượn",
    status: t.status,
    statusLabel: "Đang mượn",
    createdAt: t.created_at,
    href: "/tools",
  }));

  return {
    metrics: {
      myPendingCount: pendingReqs.length,
      readyToReceiveCount: readyTasks.length,
      myBorrowedToolsCount: toolTasks.length,
    },
    readyToReceiveList: readyTasks,
    myRecentRequisitions: recentTasks,
    myBorrowedTools: toolTasks,
  };
}

// ==========================================
// 6. DRIVER DATA (Driver)
// ==========================================
export interface DriverDashboardData {
  driverName: string;
  assignedVehicle: {
    id: string;
    code: string;
    name: string;
    licensePlate: string;
    type: string;
    calcUnit: string;
    standardRate: number | null;
  } | null;
  lastDispense: {
    id: string;
    code: string;
    liters: number;
    meter: number;
    createdAt: string;
    vehicleName: string;
  } | null;
  monthStats: {
    totalLiters: number;
    dispenseCount: number;
  };
  recentDispenses: {
    id: string;
    code: string;
    liters: number;
    vehicleName: string;
    meter: number;
    createdAt: string;
    status: string;
  }[];
}

export async function getDriverDashboardData(
  profile: Profile
): Promise<DriverDashboardData> {
  const supabase = await createClient();

  const [dispenses, vehicles] = await Promise.all([
    supabase
      .from("fuel_dispenses")
      .select("id, code, quantity, current_odo, status, created_at, vehicle:vehicles!fuel_dispenses_vehicle_id_fkey(id, code, name, type, odo_unit, fuel_norm)")
      .eq("dispenser_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("vehicles")
      .select("id, code, name, type, odo_unit, fuel_norm")
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  const dispenseList = dispenses.data ?? [];
  const last = dispenseList[0];
  const lastVehicle = last?.vehicle as unknown as { id: string; code: string; name: string; type: string; odo_unit: string; fuel_norm: number | null } | null;

  const firstVehicle = vehicles.data?.[0];

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let monthLiters = 0;
  let monthCount = 0;

  for (const d of dispenseList) {
    if (new Date(d.created_at).getTime() >= startOfMonth) {
      monthLiters += Number(d.quantity || 0);
      monthCount++;
    }
  }

  const assigned = lastVehicle || firstVehicle;

  return {
    driverName: profile.name,
    assignedVehicle: assigned ? {
      id: assigned.id,
      code: assigned.code,
      name: assigned.name,
      licensePlate: assigned.code,
      type: assigned.type,
      calcUnit: assigned.odo_unit || "km",
      standardRate: assigned.fuel_norm ? Number(assigned.fuel_norm) : null,
    } : null,
    lastDispense: last ? {
      id: last.id,
      code: last.code,
      liters: Number(last.quantity),
      meter: Number(last.current_odo || 0),
      createdAt: last.created_at,
      vehicleName: lastVehicle?.name || "Xe cơ giới",
    } : null,
    monthStats: {
      totalLiters: monthLiters,
      dispenseCount: monthCount,
    },
    recentDispenses: dispenseList.map((d) => ({
      id: d.id,
      code: d.code,
      liters: Number(d.quantity),
      vehicleName: (d.vehicle as { name?: string })?.name || "Xe cơ giới",
      meter: Number(d.current_odo || 0),
      createdAt: d.created_at,
      status: d.status,
    })),
  };
}

// ==========================================
// Helper: Load Audit Activities
// ==========================================
async function loadAuditActivities(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ActivityItem[]> {
  const { data: rawAudits } = await supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, before, after, created_at, actor:profiles!audit_logs_actor_id_fkey(id, name, role)"
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
      codeMap.set(r.id, r.code || r.name || "Chứng từ");
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
