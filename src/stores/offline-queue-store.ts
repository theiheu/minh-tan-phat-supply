import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OfflineRequisitionItem {
  skuId: string;
  transactionUnitId?: string;
  enteredQuantity: number;
  name: string;
  label: string;
  unit: string | null;
}

export interface OfflineRequisition {
  clientTempId: string;
  schemaVersion: "v2";
  items: OfflineRequisitionItem[];
  zoneId: string;
  subZoneId?: string | null;
  purpose: string;
  requesterId?: string;
  submitAfterCreate?: boolean;
  createdAt: string;
  retryCount: number;
  lastError?: string | null;
  status: "pending" | "syncing" | "failed";
}

export interface EnqueueInput {
  items: OfflineRequisitionItem[];
  zoneId: string;
  subZoneId?: string | null;
  purpose: string;
  requesterId?: string;
  submitAfterCreate?: boolean;
}

export type OfflineRequisitionPayload = EnqueueInput;

interface OfflineQueueState {
  queue: OfflineRequisition[];
  enqueue: (input: EnqueueInput) => string;
  dequeue: (clientTempId: string) => void;
  updateStatus: (clientTempId: string, status: OfflineRequisition["status"], error?: string) => void;
  clearFailed: () => void;
  clearAll: () => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (input) => {
        const clientTempId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `temp_${Date.now()}`;
        const newItem: OfflineRequisition = {
          clientTempId,
          schemaVersion: "v2",
          items: input.items,
          zoneId: input.zoneId,
          purpose: input.purpose,
          requesterId: input.requesterId,
          submitAfterCreate: input.submitAfterCreate ?? true,
          createdAt: new Date().toISOString(),
          retryCount: 0,
          status: "pending",
        };
        set((state) => ({ queue: [...state.queue, newItem] }));
        return clientTempId;
      },
      dequeue: (clientTempId) =>
        set((state) => ({
          queue: state.queue.filter((item) => item.clientTempId !== clientTempId),
        })),
      updateStatus: (clientTempId, status, error) =>
        set((state) => ({
          queue: state.queue.map((item) => {
            if (item.clientTempId !== clientTempId) return item;
            return {
              ...item,
              status,
              lastError: error !== undefined ? error : item.lastError,
              retryCount: status === "failed" ? item.retryCount + 1 : item.retryCount,
            };
          }),
        })),
      clearFailed: () =>
        set((state) => ({
          queue: state.queue.filter((item) => item.status !== "failed"),
        })),
      clearAll: () => set({ queue: [] }),
    }),
    {
      name: "mtp-offline-requisitions-queue",
      version: 2,
      migrate: (persisted: unknown) => {
        const state = persisted as { queue?: unknown[] };
        const queue = Array.isArray(state?.queue)
          ? state.queue.map((raw) => {
              const item = raw as Record<string, unknown>;
              if (item.schemaVersion === "v2") return item;
              return {
                ...item,
                status: "failed",
                lastError: "Phiếu ngoại tuyến được tạo bằng dữ liệu cũ. Vui lòng xóa phiếu này và chọn lại SKU/đơn vị.",
              };
            })
          : [];
        return { ...state, queue };
      },
    },
  ),
);
