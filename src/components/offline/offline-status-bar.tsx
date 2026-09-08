"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";

export function OfflineStatusBar({
  isOnline,
  isSyncing,
  onSyncNow,
}: {
  isOnline: boolean;
  isSyncing?: boolean;
  onSyncNow: () => void;
}) {
  const queue = useOfflineQueueStore((s) => s.queue);
  const pendingCount = queue.filter((i) => i.status !== "syncing").length;

  if (isOnline && queue.length === 0) return null;

  return (
    <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {!isOnline ? (
            <WifiOff className="size-4 shrink-0 text-amber-600 dark:text-amber-400 animate-pulse" />
          ) : (
            <RefreshCw className={`size-4 shrink-0 text-amber-600 dark:text-amber-400 ${isSyncing ? "animate-spin" : ""}`} />
          )}
          <span className="truncate">
            {!isOnline
              ? pendingCount > 0
                ? `Đang ngoại tuyến — có ${pendingCount} phiếu yêu cầu chờ đồng bộ`
                : "Đang ngoại tuyến — các phiếu tạo sẽ được lưu an toàn trên máy"
              : `Có ${pendingCount} phiếu yêu cầu chờ đồng bộ lên máy chủ`}
          </span>
        </div>

        {isOnline && pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSyncNow}
            disabled={isSyncing}
            className="h-6 px-2 text-[11px] border-amber-500/40 hover:bg-amber-500/20"
          >
            <RefreshCw className={`mr-1 size-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Đang gửi..." : "Đồng bộ ngay"}
          </Button>
        )}
      </div>
    </div>
  );
}
