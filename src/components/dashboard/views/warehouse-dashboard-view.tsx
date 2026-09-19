"use client";

import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  ClipboardList,
  Fuel,
  Package,
  PackageCheck,
  PackageMinus,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import type { WarehouseDashboardData } from "@/features/dashboard/server/get-role-dashboard-data";
import { DashboardMetricCard } from "../shared/dashboard-metric-card";
import { DashboardQuickActions, type QuickActionItem } from "../shared/dashboard-quick-actions";
import { PendingTasksCard } from "../shared/pending-tasks-card";
import { LowStockAlertCard } from "../shared/low-stock-alert-card";

interface WarehouseDashboardViewProps {
  profile: Profile;
  data: WarehouseDashboardData;
}

export function WarehouseDashboardView({
  profile,
  data,
}: WarehouseDashboardViewProps) {
  const router = useRouter();

  const quickActions: QuickActionItem[] = [
    {
      label: "Nhập kho mới",
      href: "/receipts/new",
      icon: Package,
      highlight: true,
    },
    {
      label: "Xuất kho trực tiếp",
      href: "/issues/new",
      icon: PackageMinus,
    },
    {
      label: "Đổi 1-1 cấp tốc",
      href: "/defects",
      icon: RefreshCw,
    },
    {
      label: "Nhập bồn dầu",
      href: "/fuel",
      icon: Fuel,
    },
    {
      label: "Kiểm kê kho",
      href: "/stocktake",
      icon: ClipboardCheck,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-amber-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white">
              <Warehouse className="size-3.5" />
              Quản Kho Tổng / Thủ Kho
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Kho trung tâm & Bồn dầu
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Xin chào, {profile.name}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Hàng đợi xuất cấp phát, phiếu nhập hàng và theo dõi cảnh báo tồn kho tối thiểu.
          </p>
        </div>

        <DashboardQuickActions actions={quickActions} title="" className="shrink-0" />
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <DashboardMetricCard
          icon={ClipboardList}
          label="Phiếu chờ xuất kho"
          value={data.metrics.approvedRequisitionsCount}
          tone="amber"
          hint="Đã duyệt Cấp 1, cần soạn hàng"
          onClick={() => router.push("/requisitions")}
        />
        <DashboardMetricCard
          icon={Package}
          label="Phiếu nhập đang tạo"
          value={data.metrics.draftReceiptsCount}
          tone="sky"
          hint="Phiếu nhập kho nháp"
          onClick={() => router.push("/receipts")}
        />
        <DashboardMetricCard
          icon={RefreshCw}
          label="Đổi 1-1 chờ giao"
          value={data.metrics.pendingExchangesCount}
          tone="violet"
          hint="Yêu cầu đổi thiết bị hỏng"
          onClick={() => router.push("/defects")}
        />
        <DashboardMetricCard
          icon={PackageCheck}
          label="Cảnh báo tồn kho"
          value={data.metrics.lowStockCount}
          tone="rose"
          hint="SKU chạm ngưỡng an toàn"
          onClick={() => router.push("/products")}
        />
      </div>

      {/* Low stock alert */}
      <LowStockAlertCard items={data.lowStockItems} />

      {/* Main Fulfillment Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <PendingTasksCard
          title="Hàng đợi xuất cấp phát (Phiếu yêu cầu)"
          badgeCount={data.fulfillmentQueue.length}
          items={data.fulfillmentQueue}
          emptyMessage="Không có phiếu yêu cầu nào đang chờ xuất kho."
          viewAllHref="/requisitions"
          viewAllLabel="Tất cả phiếu yêu cầu"
        />

        <div className="space-y-4 sm:space-y-6">
          <PendingTasksCard
            title="Phiếu đổi 1-1 chờ xử lý"
            badgeCount={data.pendingExchanges.length}
            items={data.pendingExchanges}
            emptyMessage="Không có phiếu đổi 1-1 nào đang chờ."
            viewAllHref="/defects"
            viewAllLabel="Quản lý đổi 1-1"
          />

          <PendingTasksCard
            title="Phiếu nhập hàng chờ nghiệm thu"
            badgeCount={data.pendingReceipts.length}
            items={data.pendingReceipts}
            emptyMessage="Không có phiếu nhập kho nháp."
            viewAllHref="/receipts"
            viewAllLabel="Quản lý nhập kho"
          />
        </div>
      </div>
    </div>
  );
}
