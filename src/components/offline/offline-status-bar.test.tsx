import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OfflineStatusBar } from "./offline-status-bar";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";

describe("OfflineStatusBar", () => {
  beforeEach(() => {
    useOfflineQueueStore.setState({ queue: [] });
  });

  it("renders nothing when online and queue is empty", () => {
    render(<OfflineStatusBar isOnline={true} onSyncNow={() => {}} />);
    expect(screen.queryByText(/ngoại tuyến/i)).toBeNull();
    expect(screen.queryByText(/chờ đồng bộ/i)).toBeNull();
  });

  it("renders offline message when offline", () => {
    render(<OfflineStatusBar isOnline={false} onSyncNow={() => {}} />);
    expect(screen.getByText(/Đang ngoại tuyến/i)).toBeInTheDocument();
  });

  it("renders queue count when pending items exist", () => {
    useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 1, name: "Bóng đèn", label: "220V", unit: "cái" }],
      zoneId: "z1",
      purpose: "Chuồng 1",
    });

    render(<OfflineStatusBar isOnline={true} onSyncNow={() => {}} />);
    expect(screen.getByText(/1 phiếu.*chờ đồng bộ/i)).toBeInTheDocument();
  });
});
