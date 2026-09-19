"use client";

import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CheckSquare,
  Fuel,
  PackageOpen,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import type { ExecutiveDashboardData } from "@/features/dashboard/server/get-role-dashboard-data";
import { DashboardMetricCard } from "../shared/dashboard-metric-card";
import { DashboardQuickActions, type QuickActionItem } from "../shared/dashboard-quick-actions";
import { PendingTasksCard } from "../shared/pending-tasks-card";
import { LowStockAlertCard } from "../shared/low-stock-alert-card";
import { ActivityHistory } from "../activity-history";

interface ExecutiveDashboardViewProps {
  profile: Profile;
  data: ExecutiveDashboardData;
}

export function ExecutiveDashboardView({
  profile,
  data,
}: ExecutiveDashboardViewProps) {
  const router = useRouter();

  const quickActions: QuickActionItem[] = [
    {
      label: "Báo cáo tổng hợp",
      href: "/reports",
      icon: BarChart3,
      highlight: true,
    },
    {
      label: "Duyệt thanh lý",
      href: "/liquidations",
      icon: Trash2,
    },
    {
      label: "Duyệt kiểm kê",
      href: "/stocktake",
      icon: CheckSquare,
    },
    ...(profile.role === "superuser"
      ? [
          {
            label: "Quản trị người dùng",
            href: "/admin/users",
            icon: Users,
          },
          {
            label: "Cấu hình hệ thống",
            href: "/admin/products",
            icon: Settings,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 rounded-2xl border border-primary/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
              <ShieldCheck className="size-3.5" />
              {profile.role === "superuser" ? "Quản Trị Hệ Thống" : "Ban Giám Đốc"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Trang Trại Minh Tân Phát
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Xin chào, {profile.name}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Bảng điều hành cấp cao: Giám sát toàn diện kho bãi, xuất cấp phát, phê duyệt và tiêu thụ dầu.
          </p>
        </div>

        <DashboardQuickActions actions={quickActions} title="" className="shrink-0" />
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <DashboardMetricCard
          icon={PackageOpen}
          label="Tổng loại vật tư"
          value={data.metrics.totalProducts}
          tone="sky"
          hint="Xem danh mục sản phẩm"
          onClick={() => router.push("/products")}
        />
        <DashboardMetricCard
          icon={CheckSquare}
          label="Phê duyệt chờ xử lý"
          value={data.metrics.pendingApprovalsCount}
          tone="amber"
          hint="Thanh lý & Cân bằng kiểm kê"
          onClick={() => router.push("/liquidations")}
        />
        <DashboardMetricCard
          icon={Boxes}
          label="Phiếu xuất tháng này"
          value={data.metrics.monthIssuesCount}
          tone="emerald"
          hint="Xuất cấp phát cho trang trại"
          onClick={() => router.push("/issues")}
        />
        <DashboardMetricCard
          icon={Fuel}
          label="Đợt cấp dầu 7 ngày qua"
          value={data.metrics.weekFuelDispensesCount}
          tone="orange"
          hint="Nhiên liệu xe cơ giới"
          onClick={() => router.push("/fuel")}
        />
      </div>

      {/* Low Stock Alerts */}
      <LowStockAlertCard items={data.lowStockItems} />

      {/* Pending Approvals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <PendingTasksCard
          title="Phiếu thanh lý chờ duyệt"
          badgeCount={data.pendingLiquidations.length}
          items={data.pendingLiquidations}
          emptyMessage="Không có phiếu thanh lý nào đang chờ duyệt."
          viewAllHref="/liquidations"
          viewAllLabel="Quản lý thanh lý"
        />

        <PendingTasksCard
          title="Phiên kiểm kê cần xử lý"
          badgeCount={data.pendingStocktakes.length}
          items={data.pendingStocktakes}
          emptyMessage="Tất cả các phiên kiểm kê đã hoàn tất."
          viewAllHref="/stocktake"
          viewAllLabel="Quản lý kiểm kê"
        />
      </div>

      {/* System Audit Activities */}
      <ActivityHistory activities={data.recentActivities} isManager={true} />
    </div>
  );
}
