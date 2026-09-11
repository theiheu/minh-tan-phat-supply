import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { RequisitionForm } from "./requisition-form";
import { useCartStore } from "@/stores/cart-store";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";
import { createRequisition, submitRequisition } from "../actions";
import { toast } from "sonner";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush, refresh: mockRefresh })),
}));

vi.mock("../actions", () => ({
  createRequisition: vi.fn(),
  submitRequisition: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    })),
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("RequisitionForm", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    useCartStore.getState().clear();
    useOfflineQueueStore.getState().clearAll();
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      configurable: true,
      writable: true,
    });
  });

  it("renders Quét QR button in Vật tư yêu cầu section and opens scanner dialog", () => {
    render(
      <RequisitionForm
        zones={[{ id: "z-1", name: "Khu vực A", description: null, created_at: "", updated_at: "", deleted_at: null }]}
      />
    );

    const scanBtn = screen.getByRole("button", { name: /Quét QR/i });
    expect(scanBtn).toBeInTheDocument();

    fireEvent.click(scanBtn);

    expect(screen.getByText("Quét mã QR / Barcode Vật tư")).toBeInTheDocument();
  });

  it("enqueues requisition to useOfflineQueueStore, clears cart, toasts info, and redirects when offline (navigator.onLine === false)", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });

    useCartStore.getState().addItem({
      variantId: "var-123",
      quantity: 3,
      name: "Ốc vít M4",
      label: "M4x20",
      unit: "Con",
    });

    render(
      <RequisitionForm
        zones={[{ id: "z-1", name: "Khu vực A", description: null, created_at: "", updated_at: "", deleted_at: null }]}
        defaultZoneId="z-1"
        currentUser={{ id: "usr-1", role: "staff", name: "Nguyễn Văn A" }}
      />
    );

    const purposeInput = screen.getByPlaceholderText("Mục đích sử dụng vật tư…");
    fireEvent.change(purposeInput, { target: { value: "Sửa máy phát" } });

    const submitBtn = screen.getByRole("button", { name: "Gửi yêu cầu" });
    fireEvent.click(submitBtn);

    expect(createRequisition).not.toHaveBeenCalled();

    const queue = useOfflineQueueStore.getState().queue;
    expect(queue.length).toBe(1);
    expect(queue[0].zoneId).toBe("z-1");
    expect(queue[0].purpose).toBe("Sửa máy phát");
    expect(queue[0].items).toEqual([
      {
        variantId: "var-123",
        quantity: 3,
        name: "Ốc vít M4",
        label: "M4x20",
        unit: "Con",
      },
    ]);
    expect(useCartStore.getState().items.length).toBe(0);
    expect(queue[0].submitAfterCreate).toBe(true);
    expect(toast.info).toHaveBeenCalledWith(
      "Đang ngoại tuyến. Phiếu yêu cầu đã được lưu trên máy và sẽ tự động gửi khi có mạng."
    );
    expect(mockPush).toHaveBeenCalledWith("/requisitions");
  });

  it("enqueues draft requisition with submitAfterCreate false when clicking Lưu nháp while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });

    useCartStore.getState().addItem({
      variantId: "var-123",
      quantity: 2,
      name: "Ốc vít M4",
      label: "M4x20",
      unit: "Con",
    });

    render(
      <RequisitionForm
        zones={[{ id: "z-1", name: "Khu vực A", description: null, created_at: "", updated_at: "", deleted_at: null }]}
        defaultZoneId="z-1"
        currentUser={{ id: "usr-1", role: "staff", name: "Nguyễn Văn A" }}
      />
    );

    const purposeInput = screen.getByPlaceholderText("Mục đích sử dụng vật tư…");
    fireEvent.change(purposeInput, { target: { value: "Lưu nháp sửa máy" } });

    const draftBtn = screen.getByRole("button", { name: "Lưu nháp" });
    fireEvent.click(draftBtn);

    expect(createRequisition).not.toHaveBeenCalled();

    const queue = useOfflineQueueStore.getState().queue;
    expect(queue.length).toBe(1);
    expect(queue[0].submitAfterCreate).toBe(false);
    expect(queue[0].purpose).toBe("Lưu nháp sửa máy");
    expect(useCartStore.getState().items.length).toBe(0);
    expect(mockPush).toHaveBeenCalledWith("/requisitions");
  });

  it("falls back to offline queue when createRequisition throws a network fetch error", async () => {
    (createRequisition as Mock).mockRejectedValue(new Error("TypeError: Failed to fetch"));

    useCartStore.getState().addItem({
      variantId: "var-456",
      quantity: 5,
      name: "Dây cáp mạng",
      label: "Cat6 1m",
      unit: "Mét",
    });

    render(
      <RequisitionForm
        zones={[{ id: "z-2", name: "Khu vực B", description: null, created_at: "", updated_at: "", deleted_at: null }]}
        defaultZoneId="z-2"
        currentUser={{ id: "usr-2", role: "staff", name: "Trần Văn B" }}
      />
    );

    const purposeInput = screen.getByPlaceholderText("Mục đích sử dụng vật tư…");
    fireEvent.change(purposeInput, { target: { value: "Bảo trì mạng" } });

    const submitBtn = screen.getByRole("button", { name: "Gửi yêu cầu" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createRequisition).toHaveBeenCalledTimes(1);
      const queue = useOfflineQueueStore.getState().queue;
      expect(queue.length).toBe(1);
      expect(queue[0].zoneId).toBe("z-2");
      expect(queue[0].purpose).toBe("Bảo trì mạng");
      expect(useCartStore.getState().items.length).toBe(0);
      expect(toast.info).toHaveBeenCalledWith(
        "Đang ngoại tuyến. Phiếu yêu cầu đã được lưu trên máy và sẽ tự động gửi khi có mạng."
      );
      expect(mockPush).toHaveBeenCalledWith("/requisitions");
    });
  });

  it("successfully creates and submits requisition when online", async () => {
    (createRequisition as Mock).mockResolvedValue("req-789");
    (submitRequisition as Mock).mockResolvedValue(undefined);

    useCartStore.getState().addItem({
      variantId: "var-789",
      quantity: 1,
      name: "Bóng đèn LED",
      label: "LED 20W",
      unit: "Cái",
    });

    render(
      <RequisitionForm
        zones={[{ id: "z-1", name: "Khu vực A", description: null, created_at: "", updated_at: "", deleted_at: null }]}
        defaultZoneId="z-1"
        currentUser={{ id: "usr-1", role: "staff", name: "Nguyễn Văn A" }}
      />
    );

    const purposeInput = screen.getByPlaceholderText("Mục đích sử dụng vật tư…");
    fireEvent.change(purposeInput, { target: { value: "Thay bóng đèn hỏng" } });

    const submitBtn = screen.getByRole("button", { name: "Gửi yêu cầu" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createRequisition).toHaveBeenCalledWith({
        zoneId: "z-1",
        purpose: "Thay bóng đèn hỏng",
        requesterId: undefined,
        items: [{ variantId: "var-789", quantity: 1 }],
      });
      expect(submitRequisition).toHaveBeenCalledWith("req-789");
      expect(useCartStore.getState().items.length).toBe(0);
      expect(useOfflineQueueStore.getState().queue.length).toBe(0);
      expect(toast.success).toHaveBeenCalledWith("Đã gửi phiếu yêu cầu");
      expect(mockPush).toHaveBeenCalledWith("/requisitions/req-789");
    });
  });

  it("leaves subZoneId optional by default and does not auto-populate from user default when creating slip", async () => {
    (createRequisition as Mock).mockResolvedValue("req-100");
    (submitRequisition as Mock).mockResolvedValue(undefined);

    useCartStore.getState().addItem({
      variantId: "var-100",
      quantity: 2,
      name: "Tấm làm mát",
      label: "Cooling Pad 1.8m",
      unit: "Tấm",
    });

    render(
      <RequisitionForm
        zones={[{ id: "z-1", name: "Khu vực A", description: null, created_at: "", updated_at: "", deleted_at: null }]}
        subZones={[{ id: "sz-1", zone_id: "z-1", name: "Trại 1", description: null, display_order: 1, created_at: "", updated_at: "", deleted_at: null }]}
        defaultZoneId="z-1"
        defaultSubZoneId={null}
        currentUser={{ id: "usr-1", role: "staff", name: "Nguyễn Văn A" }}
      />
    );

    const purposeInput = screen.getByPlaceholderText("Mục đích sử dụng vật tư…");
    fireEvent.change(purposeInput, { target: { value: "Thay tấm làm mát chung toàn khu" } });

    const submitBtn = screen.getByRole("button", { name: "Gửi yêu cầu" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createRequisition).toHaveBeenCalledWith({
        zoneId: "z-1",
        subZoneId: undefined,
        purpose: "Thay tấm làm mát chung toàn khu",
        requesterId: undefined,
        items: [{ variantId: "var-100", quantity: 2 }],
      });
    });
  });
});
