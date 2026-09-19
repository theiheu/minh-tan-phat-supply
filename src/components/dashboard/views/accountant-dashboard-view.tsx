"use client";

import { useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  Package,
  PackageMinus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import type { AccountantDashboardData } from "@/features/dashboard/server/get-role-dashboard-data";
import { DashboardMetricCard } from "../shared/dashboard-metric-card";
import { DashboardQuickActions, type QuickActionItem } from "../shared/dashboard-quick-actions";
import { PendingTasksCard } from "../shared/pending-tasks-card";

interface AccountantDashboardViewProps {
  profile: Profile;
  data: AccountantDashboardData;
}

export function AccountantDashboardView({
  profile,
  data,
}: AccountantDashboardViewProps) {
  const router = useRouter();

  const quickActions: QuickActionItem[] = [
    {
      label: "Báo cáo kho & Chi phí",
      href: "/reports",
      icon: BarChart3,
      highlight: true,
    },
    {
      label: "Phiếu nhập kho (NCC)",
      href: "/receipts",
      icon: Package,
    },
    {
      label: "Phiếu xuất kho",
      href: "/issues",
      icon: PackageMinus,
    },
    {
      label: "Nhà cung cấp",
      href: "/admin/suppliers",
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-linear-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-emerald-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
              <FileSpreadsheet className="size-3.5" />
              Kế Toán Kho & Nội Bộ
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Sổ sách & Chứng từ
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Xin chào, {profile.name}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Theo dõi hóa đơn đỏ VAT, đối soát chứng từ nhập xuất và chi phí vật tư theo trang trại.
          </p>
        </div>

        <DashboardQuickActions actions={quickActions} title="" className="shrink-0" />
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <DashboardMetricCard
          icon={FileText}
          label="Phiếu nhập nháp / Chờ ghi"
          value={data.metrics.draftReceiptsCount}
          tone="amber"
          hint="Cần kiểm tra hóa đơn & đơn giá"
          onClick={() => router.push("/receipts")}
        />
        <DashboardMetricCard
          icon={TrendingUp}
          label="Phiếu thanh lý chờ duyệt"
          value={data.metrics.pendingLiquidationsCount}
          tone="rose"
          hint="Doanh thu phế liệu ve chai"
          onClick={() => router.push("/liquidations")}
        />
        <DashboardMetricCard
          icon={TrendingDown}
          label="Phiếu xuất gần đây"
          value={data.metrics.monthIssuesCount}
          tone="emerald"
          hint="Chi phí xuất theo khu / khách"
          onClick={() => router.push("/issues")}
        />
        <DashboardMetricCard
          icon={CheckSquare}
          label="Kiểm kê chờ đối soát"
          value={data.metrics.pendingStocktakesCount}
          tone="violet"
          hint="Xác nhận số liệu chênh lệch"
          onClick={() => router.push("/stocktake")}
        />
      </div>

      {/* Main Tasks Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <PendingTasksCard
          title="Phiếu nhập kho mới (Cần rà soát)"
          badgeCount={data.pendingReceipts.length}
          items={data.pendingReceipts}
          emptyMessage="Không có phiếu nhập kho nào cần rà soát."
          viewAllHref="/receipts"
          viewAllLabel="Xem tất cả phiếu nhập"
        />

        <PendingTasksCard
          title="Phiếu xuất kho gần đây"
          badgeCount={data.recentIssues.length}
          items={data.recentIssues}
          emptyMessage="Chưa có phiếu xuất kho nào phát sinh."
          viewAllHref="/issues"
          viewAllLabel="Xem tất cả phiếu xuất"
        />
      </div>
    </div>
  );
}
