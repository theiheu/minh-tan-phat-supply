"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  PackagePlus,
  RefreshCw,
  Wrench,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import type { TechnicianDashboardData } from "@/features/dashboard/server/get-role-dashboard-data";
import { DashboardMetricCard } from "../shared/dashboard-metric-card";
import { DashboardQuickActions, type QuickActionItem } from "../shared/dashboard-quick-actions";
import { PendingTasksCard } from "../shared/pending-tasks-card";

interface TechnicianDashboardViewProps {
  profile: Profile;
  data: TechnicianDashboardData;
}

export function TechnicianDashboardView({
  profile,
  data,
}: TechnicianDashboardViewProps) {
  const router = useRouter();

  const quickActions: QuickActionItem[] = [
    {
      label: "Duyệt phiếu xin cấp",
      href: "/requisitions",
      icon: ClipboardCheck,
      highlight: true,
    },
    {
      label: "Đổi 1-1 vật tư hỏng",
      href: "/defects",
      icon: RefreshCw,
    },
    {
      label: "Tạo đơn gửi sửa chữa",
      href: "/repairs",
      icon: Wrench,
    },
    {
      label: "Báo hỏng thiết bị",
      href: "/defects/new",
      icon: AlertTriangle,
    },
    {
      label: "Xin cấp vật tư",
      href: "/products",
      icon: PackagePlus,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-linear-to-r from-blue-500/10 via-blue-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-blue-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
              <Wrench className="size-3.5" />
              Kỹ Thuật Trưởng / Quản Lý Khu
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Cơ điện & Chuồng trại
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Xin chào, {profile.name}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Duyệt Cấp 1 đề xuất vật tư của công nhân, theo dõi bảo trì thiết bị và đổi mới vật tư khẩn cấp.
          </p>
        </div>

        <DashboardQuickActions actions={quickActions} title="" className="shrink-0" />
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <DashboardMetricCard
          icon={ClipboardList}
          label="Phiếu chờ duyệt Cấp 1"
          value={data.metrics.pendingApprovalReqsCount}
          tone="amber"
          hint="Công nhân trong khu gửi lên"
          onClick={() => router.push("/requisitions")}
        />
        <DashboardMetricCard
          icon={Wrench}
          label="Thiết bị gửi xưởng sửa"
          value={data.metrics.activeRepairsCount}
          tone="violet"
          hint="Quấn motor, sửa cơ khí ngoài"
          onClick={() => router.push("/repairs")}
        />
        <DashboardMetricCard
          icon={AlertTriangle}
          label="Phiếu báo hỏng mới"
          value={data.metrics.stagingDefectsCount}
          tone="rose"
          hint="Cần phân loại sửa hay thanh lý"
          onClick={() => router.push("/defects")}
        />
        <DashboardMetricCard
          icon={ClipboardCheck}
          label="Đồ nghề đang mượn"
          value={data.metrics.borrowedToolsCount}
          tone="sky"
          hint="Dụng cụ đang mượn từ kho"
          onClick={() => router.push("/tools")}
        />
      </div>

      {/* Actionable Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <PendingTasksCard
          title="Phiếu yêu cầu cần duyệt Cấp 1"
          badgeCount={data.pendingRequisitions.length}
          items={data.pendingRequisitions}
          emptyMessage="Không có phiếu yêu cầu nào đang chờ duyệt."
          viewAllHref="/requisitions"
          viewAllLabel="Xem tất cả"
        />

        <div className="space-y-4 sm:space-y-6">
          <PendingTasksCard
            title="Thiết bị đang gửi xưởng sửa chữa"
            badgeCount={data.activeRepairs.length}
            items={data.activeRepairs}
            emptyMessage="Không có thiết bị nào đang ở xưởng sửa chữa."
            viewAllHref="/repairs"
            viewAllLabel="Quản lý sửa chữa"
          />

          <PendingTasksCard
            title="Phiếu báo hỏng cần kiểm tra"
            badgeCount={data.stagingDefects.length}
            items={data.stagingDefects}
            emptyMessage="Không có báo hỏng mới phát sinh."
            viewAllHref="/defects"
            viewAllLabel="Xem vật tư hỏng"
          />
        </div>
      </div>
    </div>
  );
}
