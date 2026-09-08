import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OfflineSyncProvider } from "./offline-sync-provider";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";
import { createRequisition } from "@/features/requisitions/actions";
import { toast } from "sonner";

vi.mock("@/features/requisitions/actions", () => ({
  createRequisition: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("OfflineSyncProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOfflineQueueStore.setState({ queue: [] });
  });

  it("renders children properly", () => {
    render(
      <OfflineSyncProvider>
        <div data-testid="child-content">App Content</div>
      </OfflineSyncProvider>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("syncs pending queue items automatically on mount when online", async () => {
    (createRequisition as Mock).mockResolvedValue({ id: "req-1" });

    useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 2, name: "Cáp điện", label: "2.5mm", unit: "m" }],
      zoneId: "z1",
      purpose: "Sửa điện",
      requesterId: "user-1",
    });

    await act(async () => {
      render(
        <OfflineSyncProvider>
          <div>Content</div>
        </OfflineSyncProvider>
      );
    });

    await vi.waitFor(() => {
      expect(createRequisition).toHaveBeenCalledTimes(1);
      expect(createRequisition).toHaveBeenCalledWith({
        zoneId: "z1",
        purpose: "Sửa điện",
        requesterId: "user-1",
        items: [{ variantId: "v1", quantity: 2 }],
      });
      expect(useOfflineQueueStore.getState().queue.length).toBe(0);
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Đã tự động gửi thành công 1 phiếu yêu cầu ngoại tuyến"),
        expect.any(Object)
      );
    });
  });

  it("handles sync failure by setting status to failed", async () => {
    (createRequisition as Mock).mockRejectedValue(new Error("Server error"));

    const id = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 2, name: "Cáp điện", label: "2.5mm", unit: "m" }],
      zoneId: "z1",
      purpose: "Sửa điện",
    });

    await act(async () => {
      render(
        <OfflineSyncProvider>
          <div>Content</div>
        </OfflineSyncProvider>
      );
    });

    await vi.waitFor(() => {
      expect(createRequisition).toHaveBeenCalledTimes(1);
      const item = useOfflineQueueStore.getState().queue.find((i) => i.clientTempId === id);
      expect(item?.status).toBe("failed");
      expect(item?.lastError).toBe("Server error");
    });
  });

  it("triggers sync on online event", async () => {
    (createRequisition as Mock).mockResolvedValue({ id: "req-1" });

    await act(async () => {
      render(
        <OfflineSyncProvider>
          <div>Content</div>
        </OfflineSyncProvider>
      );
    });

    await act(async () => {
      useOfflineQueueStore.getState().enqueue({
        items: [{ variantId: "v1", quantity: 1, name: "Bóng đèn", label: "220V", unit: "cái" }],
        zoneId: "z1",
        purpose: "Thay bóng",
      });
      window.dispatchEvent(new Event("online"));
    });

    await vi.waitFor(() => {
      expect(createRequisition).toHaveBeenCalledTimes(1);
      expect(useOfflineQueueStore.getState().queue.length).toBe(0);
    });
  });
});
