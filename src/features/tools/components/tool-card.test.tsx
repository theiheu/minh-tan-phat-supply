import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToolCard } from "./tool-card";
import { ToolBorrowDialog } from "./tool-borrow-dialog";
import { ToolReturnDialog } from "./tool-return-dialog";
import { createToolBorrowing, returnToolBorrowing } from "../actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("../actions", () => ({
  createToolBorrowing: vi.fn().mockResolvedValue("mock-borrowing-id"),
  returnToolBorrowing: vi.fn().mockResolvedValue(undefined),
  cancelToolBorrowing: vi.fn().mockResolvedValue(undefined),
}));

describe("ToolCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tool details and remaining quantity", () => {
    render(
      <ToolCard
        borrowingId="b1"
        code="MDC-20260908-0001"
        productName="Máy hàn que"
        variantLabel="250A Inverter"
        quantity={2}
        returnedQuantity={0}
        borrowedAt="2026-09-08T08:00:00Z"
        expectedReturnDate="2026-09-10"
        purpose="Hàn khung chuồng"
        borrowerName="Nguyễn Văn A"
        isManager={false}
      />,
    );

    expect(screen.getByText("Máy hàn que")).toBeInTheDocument();
    expect(screen.getByText(/Đang giữ: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Hàn khung chuồng/i)).toBeInTheDocument();
    expect(screen.getByText(/Nguyễn Văn A/i)).toBeInTheDocument();
  });

  it("calculates and displays overdue badge when expected return date has passed", () => {
    // 5 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const pastDateStr = pastDate.toISOString().split("T")[0];

    render(
      <ToolCard
        borrowingId="b2"
        code="MDC-20260908-0002"
        productName="Máy khoan bê tông"
        quantity={1}
        returnedQuantity={0}
        borrowedAt="2026-09-01T08:00:00Z"
        expectedReturnDate={pastDateStr}
        purpose="Khoan tường trại 2"
        borrowerName="Trần Văn B"
        isManager={true}
      />,
    );

    expect(screen.getByText(/Quá hạn 5 ngày/i)).toBeInTheDocument();
  });

  it("displays return guidance message for regular requester when items are not fully returned", () => {
    render(
      <ToolCard
        borrowingId="b3"
        code="MDC-20260908-0003"
        productName="Kìm bấm mạng"
        quantity={3}
        returnedQuantity={1}
        borrowedAt="2026-09-08T08:00:00Z"
        purpose="Bấm dây camera"
        borrowerName="Lê Văn C"
        isManager={false}
      />,
    );

    expect(screen.getByText(/Đang giữ: 2/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Mang dụng cụ về Kho chính để thủ kho nhận lại/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xác nhận nhận lại/i })).not.toBeInTheDocument();
  });

  it("displays manager action button label when isManager is true", () => {
    render(
      <ToolCard
        borrowingId="b3-mgr"
        code="MDC-20260908-0003"
        productName="Kìm bấm mạng"
        quantity={3}
        returnedQuantity={1}
        borrowedAt="2026-09-08T08:00:00Z"
        purpose="Bấm dây camera"
        borrowerName="Lê Văn C"
        isManager={true}
      />,
    );

    expect(screen.getByRole("button", { name: /Xác nhận nhận lại/i })).toBeInTheDocument();
  });

  it("displays completed returned status when remaining quantity is 0", () => {
    render(
      <ToolCard
        borrowingId="b4"
        code="MDC-20260908-0004"
        productName="Máy cắt sắt"
        quantity={1}
        returnedQuantity={1}
        borrowedAt="2026-09-08T08:00:00Z"
        purpose="Cắt sắt rào"
        borrowerName="Lê Văn C"
        isManager={false}
      />,
    );

    expect(screen.getByText(/Đã trả đủ/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xác nhận nhận lại/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Mang dụng cụ về Kho chính để thủ kho nhận lại/i),
    ).not.toBeInTheDocument();
  });
});

describe("ToolBorrowDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger and allows filling and submitting borrowing request", async () => {
    const mockVariants = [
      { id: "v-1", name: "Máy cắt sắt Bosch", detail: "GWS 750", availableStock: 5 },
      { id: "v-2", name: "Máy hàn que Jasic", detail: "ARC 200", availableStock: 2 },
    ];

    render(
      <ToolBorrowDialog
        variants={mockVariants}
        zones={[{ id: "z-1", name: "Khu Trại A" }]}
      />,
    );

    const triggerBtn = screen.getByRole("button", { name: /Mượn dụng cụ/i });
    expect(triggerBtn).toBeInTheDocument();
    fireEvent.click(triggerBtn);

    expect(screen.getByRole("heading", { name: /Mượn dụng cụ/i })).toBeInTheDocument();

    // Select variant
    const variantSelect = screen.getByPlaceholderText(/Chọn dụng cụ cần mượn/i);
    fireEvent.change(variantSelect, { target: { value: "Máy cắt sắt Bosch" } });
    fireEvent.click(screen.getByText(/Máy cắt sắt Bosch/i));

    // Fill purpose
    const purposeInput = screen.getByPlaceholderText(/VD: Hàn khung chuồng, sửa ống nước/i);
    fireEvent.change(purposeInput, { target: { value: "Sửa chuồng heo A2" } });

    // Click quick preset for return date (+3 ngày)
    const preset3Days = screen.getByRole("button", { name: /\+3 ngày/i });
    fireEvent.click(preset3Days);

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Xác nhận mượn/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createToolBorrowing).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ variantId: "v-1", quantity: 1 }],
          purpose: "Sửa chuồng heo A2",
        }),
      );
    });
  });

  it("supports quick preset +1 ngày and +7 ngày", () => {
    render(
      <ToolBorrowDialog
        variants={[{ id: "v-1", name: "Máy cắt sắt", availableStock: 5 }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Mượn dụng cụ/i }));

    const preset1Day = screen.getByRole("button", { name: /\+1 ngày/i });
    fireEvent.click(preset1Day);

    const dateInput = document.getElementById("expected-return-date") as HTMLInputElement;
    expect(dateInput.value).not.toBe("");

    const preset7Days = screen.getByRole("button", { name: /\+7 ngày/i });
    fireEvent.click(preset7Days);
    expect(dateInput.value).not.toBe("");
  });
});

describe("ToolReturnDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders borrowed items and handles return quantity submission", async () => {
    render(
      <ToolReturnDialog
        borrowingId="b-10"
        code="MDC-20260908-0010"
        productName="Bộ cờ lê đa năng"
        variantId="v-10"
        quantity={3}
        returnedQuantity={1}
      />,
    );

    const triggerBtn = screen.getByRole("button", { name: /Báo trả/i });
    fireEvent.click(triggerBtn);

    expect(screen.getByRole("heading", { name: /Trả dụng cụ/i })).toBeInTheDocument();
    expect(screen.getByText(/Bộ cờ lê đa năng/i)).toBeInTheDocument();
    expect(screen.getByText(/Còn giữ: 2/i)).toBeInTheDocument();

    // Notes
    const notesInput = screen.getByPlaceholderText(/Ghi chú tình trạng thiết bị khi trả/i);
    fireEvent.change(notesInput, { target: { value: "Dụng cụ hoạt động tốt, đã vệ sinh" } });

    // Submit return
    const submitBtn = screen.getByRole("button", { name: /Xác nhận trả dụng cụ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(returnToolBorrowing).toHaveBeenCalledWith({
        borrowingId: "b-10",
        items: [{ variantId: "v-10", quantity: 2 }],
        notes: "Dụng cụ hoạt động tốt, đã vệ sinh",
      });
    });
  });

  it("handles multiple items in ToolReturnDialog with full return", async () => {
    render(
      <ToolReturnDialog
        borrowingId="b-20"
        code="MDC-20260908-0020"
        items={[
          { variantId: "v-1", name: "Máy mài góc", quantity: 2, returnedQuantity: 0 },
          { variantId: "v-2", name: "Kìm chết", quantity: 1, returnedQuantity: 0 },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Báo trả/i }));

    expect(screen.getByText(/Máy mài góc/i)).toBeInTheDocument();
    expect(screen.getByText(/Kìm chết/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Xác nhận trả dụng cụ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(returnToolBorrowing).toHaveBeenCalledWith({
        borrowingId: "b-20",
        items: [
          { variantId: "v-1", quantity: 2 },
          { variantId: "v-2", quantity: 1 },
        ],
        notes: undefined,
      });
    });
  });
});
