"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Clock,
  Package,
  PackageCheck,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import type { RequesterDashboardData } from "@/features/dashboard/server/get-role-dashboard-data";
import { DashboardMetricCard } from "../shared/dashboard-metric-card";
import { PendingTasksCard } from "../shared/pending-tasks-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RequesterDashboardViewProps {
  profile: Profile;
  data: RequesterDashboardData;
}

export function RequesterDashboardView({
  profile,
  data,
}: RequesterDashboardViewProps) {
  const router = useRouter();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Mobile-Friendly Profile Card */}
      <div className="bg-linear-to-br from-primary/15 via-primary/5 to-background p-4 sm:p-5 rounded-2xl border border-primary/20 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Package className="size-3.5" />
              Công Nhân Chuồng / Người Yêu Cầu
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Xin chào, {profile.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              Tạo phiếu xin cấp vật tư nhanh hoặc bấm nhận hàng khi kho đã chuẩn bị xong.
            </p>
          </div>
        </div>
      </div>

      {/* Hero 3 Big Mobile Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <Button
          asChild
          size="lg"
          className="h-16 sm:h-20 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/95 shadow-md flex items-center justify-start px-4 gap-3.5 group transition-all"
        >
          <Link href="/products">
            <div className="size-10 sm:size-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShoppingCart className="size-5 sm:size-6 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm sm:text-base font-bold leading-tight">Xin cấp vật tư</div>
              <div className="text-[11px] text-primary-foreground/80 font-normal">Chọn đồ từ danh mục</div>
            </div>
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-16 sm:h-20 rounded-2xl bg-card border-border hover:border-primary/40 hover:bg-accent shadow-xs flex items-center justify-start px-4 gap-3.5 group transition-all"
        >
          <Link href="/tools">
            <div className="size-10 sm:size-12 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Wrench className="size-5 sm:size-6" />
            </div>
            <div className="text-left">
              <div className="text-sm sm:text-base font-bold leading-tight text-foreground">Mượn dụng cụ</div>
              <div className="text-[11px] text-muted-foreground font-normal">Đồ nghề làm chuồng</div>
            </div>
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-16 sm:h-20 rounded-2xl bg-card border-border hover:border-amber-400 hover:bg-amber-500/5 shadow-xs flex items-center justify-start px-4 gap-3.5 group transition-all"
        >
          <Link href="/defects/new">
            <div className="size-10 sm:size-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Camera className="size-5 sm:size-6" />
            </div>
            <div className="text-left">
              <div className="text-sm sm:text-base font-bold leading-tight text-foreground">Báo hỏng thiết bị</div>
              <div className="text-[11px] text-muted-foreground font-normal">Chụp ảnh gửi kỹ thuật</div>
            </div>
          </Link>
        </Button>
      </div>

      {/* Personal Status Metric Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <DashboardMetricCard
          icon={Clock}
          label="Đang chờ duyệt"
          value={data.metrics.myPendingCount}
          tone="amber"
          hint="Phiếu đang đợi ký"
          onClick={() => router.push("/requisitions")}
        />
        <DashboardMetricCard
          icon={PackageCheck}
          label="Chờ nhận hàng"
          value={data.metrics.readyToReceiveCount}
          tone="emerald"
          hint="Kho đã xuất xong"
          onClick={() => router.push("/requisitions")}
        />
        <DashboardMetricCard
          icon={Wrench}
          label="Đang mượn"
          value={data.metrics.myBorrowedToolsCount}
          tone="violet"
          hint="Dụng cụ đang giữ"
          onClick={() => router.push("/tools")}
        />
      </div>

      {/* Priority 1: Ready to receive goods (Action required!) */}
      {data.readyToReceiveList.length > 0 && (
        <Card className="border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-500/5 rounded-2xl shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <PackageCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-sm sm:text-base font-bold text-emerald-950 dark:text-emerald-200">
                Hàng đã xuất — Vui lòng nhận vật tư ({data.readyToReceiveList.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pt-0 space-y-2.5">
            {data.readyToReceiveList.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-background gap-2"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary">{item.code}</span>
                    <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 dark:text-emerald-300">
                      Đã có hàng
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                </div>
                <Button
                  asChild
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-8.5 px-4 text-xs rounded-lg shrink-0"
                >
                  <Link href={item.href || `/requisitions/${item.id}`}>
                    <CheckCircle2 className="size-3.5 mr-1" />
                    Xác nhận nhận hàng
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Personal Requisitions */}
      <PendingTasksCard
        title="Lịch sử yêu cầu vật tư của tôi"
        badgeCount={data.myRecentRequisitions.length}
        items={data.myRecentRequisitions}
        emptyMessage="Bạn chưa có phiếu yêu cầu nào."
        viewAllHref="/requisitions"
        viewAllLabel="Tất cả phiếu của tôi"
      />
    </div>
  );
}
