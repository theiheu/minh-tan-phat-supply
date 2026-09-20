"use client";

import { CheckCircle2, CloudDownload, CloudOff, CloudUpload } from "lucide-react";
import { usePowerSyncSyncStatus } from "@/lib/powersync/hooks";
import { Badge } from "@/components/ui/badge";

export function PowerSyncStatusBadge() {
  const { isReady, isConnected, downloading, uploading, error } = usePowerSyncSyncStatus();

  if (!isReady) return null;

  let icon = <CheckCircle2 className="size-3 text-emerald-500" />;
  let label = "Đã đồng bộ";
  let description = "Dữ liệu ngoại tuyến trên SQLite local đã khớp với máy chủ";
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";

  if (error) {
    icon = <CloudOff className="size-3 text-destructive" />;
    label = "Lỗi đồng bộ";
    description = error.message || "Không thể kết nối với máy chủ PowerSync";
    variant = "destructive";
  } else if (downloading) {
    icon = <CloudDownload className="size-3 text-sky-500 animate-bounce" />;
    label = "Đang nạp...";
    description = "Đang tải danh mục và dữ liệu mới nhất về SQLite trên máy";
    variant = "secondary";
  } else if (uploading) {
    icon = <CloudUpload className="size-3 text-amber-500 animate-pulse" />;
    label = "Đang gửi...";
    description = "Đang đẩy các thao tác ngoại tuyến lên máy chủ Supabase";
    variant = "secondary";
  } else if (!isConnected) {
    icon = <CloudOff className="size-3 text-muted-foreground" />;
    label = "Ngoại tuyến (SQLite)";
    description = "Đang làm việc độc lập trên cơ sở dữ liệu SQLite cục bộ";
    variant = "outline";
  }

  return (
    <Badge
      variant={variant}
      title={"PowerSync Local-First Engine: " + description}
      className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-normal cursor-help"
    >
      {icon}
      <span>{label}</span>
    </Badge>
  );
}
