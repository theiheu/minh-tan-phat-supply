import { describe, it, expect, beforeEach } from "vitest";
import { useOfflineQueueStore } from "./offline-queue-store";

describe("useOfflineQueueStore", () => {
  beforeEach(() => {
    useOfflineQueueStore.setState({ queue: [] });
    localStorage.clear();
  });

  it("enqueues a new offline requisition item", () => {
    const id = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 5, name: "Bóng đèn", label: "220V 45W", unit: "cái" }],
      zoneId: "z1",
      purpose: "Thay bóng hỏng chuồng 2",
      requesterId: "u1",
    });

    expect(id).toBeDefined();
    const queue = useOfflineQueueStore.getState().queue;
    expect(queue.length).toBe(1);
    expect(queue[0].clientTempId).toBe(id);
    expect(queue[0].status).toBe("pending");
    expect(queue[0].items[0].name).toBe("Bóng đèn");
  });

  it("dequeues an item by clientTempId", () => {
    const id1 = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 2, name: "Món 1", label: "L1", unit: "cái" }],
      zoneId: "z1",
      purpose: "P1",
      requesterId: "u1",
    });
    const id2 = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v2", quantity: 3, name: "Món 2", label: "L2", unit: "cái" }],
      zoneId: "z1",
      purpose: "P2",
      requesterId: "u1",
    });

    expect(useOfflineQueueStore.getState().queue.length).toBe(2);
    useOfflineQueueStore.getState().dequeue(id1);
    const queue = useOfflineQueueStore.getState().queue;
    expect(queue.length).toBe(1);
    expect(queue[0].clientTempId).toBe(id2);
  });

  it("updates status and error of a queued item", () => {
    const id = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 1, name: "Món 1", label: "L1", unit: "cái" }],
      zoneId: "z1",
      purpose: "P1",
      requesterId: "u1",
    });

    useOfflineQueueStore.getState().updateStatus(id, "syncing");
    expect(useOfflineQueueStore.getState().queue[0].status).toBe("syncing");

    useOfflineQueueStore.getState().updateStatus(id, "failed", "Mạng không khả dụng");
    expect(useOfflineQueueStore.getState().queue[0].status).toBe("failed");
    expect(useOfflineQueueStore.getState().queue[0].lastError).toBe("Mạng không khả dụng");
    expect(useOfflineQueueStore.getState().queue[0].retryCount).toBe(1);
  });

  it("clears failed items and clears all items", () => {
    const id1 = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 1, name: "Món 1", label: "L1", unit: "cái" }],
      zoneId: "z1",
      purpose: "P1",
    });
    const id2 = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v2", quantity: 2, name: "Món 2", label: "L2", unit: "cái" }],
      zoneId: "z2",
      purpose: "P2",
    });

    useOfflineQueueStore.getState().updateStatus(id1, "failed", "Lỗi kết nối");
    expect(useOfflineQueueStore.getState().queue.length).toBe(2);

    useOfflineQueueStore.getState().clearFailed();
    expect(useOfflineQueueStore.getState().queue.length).toBe(1);
    expect(useOfflineQueueStore.getState().queue[0].clientTempId).toBe(id2);

    useOfflineQueueStore.getState().clearAll();
    expect(useOfflineQueueStore.getState().queue.length).toBe(0);
  });
});
