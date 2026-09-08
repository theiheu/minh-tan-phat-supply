"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";
import { createRequisition, submitRequisition } from "@/features/requisitions/actions";
import { OfflineStatusBar } from "./offline-status-bar";

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  const dequeue = useOfflineQueueStore((s) => s.dequeue);
  const updateStatus = useOfflineQueueStore((s) => s.updateStatus);

  const syncQueue = useCallback(async () => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const currentQueue = useOfflineQueueStore.getState().queue;
    const pendingItems = currentQueue.filter((i) => i.status === "pending" || i.status === "failed");
    if (pendingItems.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    let successCount = 0;

    try {
      for (const item of pendingItems) {
        updateStatus(item.clientTempId, "syncing");
        try {
          const reqId = await createRequisition({
            zoneId: item.zoneId,
            purpose: item.purpose,
            requesterId: item.requesterId,
            items: item.items.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
            })),
          });

          if (item.submitAfterCreate !== false) {
            await submitRequisition(reqId);
          }

          dequeue(item.clientTempId);
          successCount++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Lỗi đồng bộ";
          updateStatus(item.clientTempId, "failed", errorMsg);
        }
      }

      if (successCount > 0) {
        toast.success(`Đã tự động gửi thành công ${successCount} phiếu yêu cầu ngoại tuyến lên hệ thống!`, {
          duration: 5000,
        });
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [dequeue, updateStatus]);

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const handleOnline = () => {
      setIsOnline(true);
      toast.info("Đã khôi phục kết nối mạng. Đang kiểm tra đồng bộ...");
      syncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        syncQueue();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial check on mount
    if (navigator.onLine) {
      syncQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncQueue]);

  return (
    <>
      <OfflineStatusBar isOnline={isOnline} isSyncing={isSyncing} onSyncNow={syncQueue} />
      {children}
    </>
  );
}
