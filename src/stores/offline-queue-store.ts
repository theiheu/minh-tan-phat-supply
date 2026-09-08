import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OfflineRequisitionItem {
  variantId: string;
  quantity: number;
  name: string;
  label: string;
  unit: string | null;
}

export interface OfflineRequisition {
  clientTempId: string;
  items: OfflineRequisitionItem[];
  zoneId: string;
  purpose: string;
  requesterId?: string;
  createdAt: string;
  retryCount: number;
  lastError?: string | null;
  status: "pending" | "syncing" | "failed";
}

export interface EnqueueInput {
  items: OfflineRequisitionItem[];
  zoneId: string;
  purpose: string;
  requesterId?: string;
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
          items: input.items,
          zoneId: input.zoneId,
          purpose: input.purpose,
          requesterId: input.requesterId,
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
    { name: "mtp-offline-requisitions-queue" },
  ),
);
