import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FuelTypeDialog } from "./fuel-type-dialog";
import * as fuelActions from "../actions";

vi.mock("../actions", () => ({
  createFuelTypeAction: vi.fn(),
  updateFuelTypeAction: vi.fn(),
}));

describe("FuelTypeDialog Component", () => {
  it("renders create dialog with preset templates and fields when open", () => {
    render(<FuelTypeDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/Thêm loại nhiên liệu \/ dầu nhớt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên loại nhiên liệu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mã phân loại/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Đơn vị tính/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tồn kho ban đầu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mức tồn tối thiểu/i)).toBeInTheDocument();

    // Preset chips
    expect(screen.getByText("Dầu Diesel DO 0.05S-II")).toBeInTheDocument();
    expect(screen.getByText("Nhớt động cơ 15W-40")).toBeInTheDocument();
  });

  it("applies preset when clicking a template button", () => {
    render(<FuelTypeDialog open={true} onOpenChange={vi.fn()} />);

    const dieselPreset = screen.getByText("Dầu Diesel DO 0.05S-II");
    fireEvent.click(dieselPreset);

    const nameInput = screen.getByLabelText(/Tên loại nhiên liệu/i) as HTMLInputElement;
    const codeInput = screen.getByLabelText(/Mã phân loại/i) as HTMLInputElement;

    expect(nameInput.value).toBe("Dầu Diesel DO 0.05S-II");
    expect(codeInput.value).toBe("DIESEL_DO_005");
  });

  it("calls createFuelTypeAction on submit in create mode", async () => {
    const mockCreate = vi.mocked(fuelActions.createFuelTypeAction).mockResolvedValue({
      id: "ft-new",
      name: "Nhớt 15W40",
      code: "NHOT_15W40",
      unit: "lít",
      current_stock: 0,
      min_stock: 50,
      description: null,
      is_active: true,
      created_at: "",
      updated_at: "",
    });

    const onSaved = vi.fn();
    render(<FuelTypeDialog open={true} onOpenChange={vi.fn()} onSaved={onSaved} />);

    const nameInput = screen.getByLabelText(/Tên loại nhiên liệu/i);
    const codeInput = screen.getByLabelText(/Mã phân loại/i);

    fireEvent.change(nameInput, { target: { value: "Nhớt 15W40" } });
    fireEvent.change(codeInput, { target: { value: "NHOT_15W40" } });

    const submitBtn = screen.getByRole("button", { name: /Tạo loại dầu/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Nhớt 15W40",
          code: "NHOT_15W40",
        })
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("renders in edit mode when fuelType is provided", () => {
    const mockFuelType = {
      id: "ft-1",
      name: "Dầu Diesel DO 0.05S",
      code: "DIESEL_DO_005",
      unit: "lít",
      current_stock: 5000,
      min_stock: 1000,
      description: "Dầu chạy xe",
      is_active: true,
      created_at: "",
      updated_at: "",
    };

    render(
      <FuelTypeDialog
        mode="edit"
        fuelType={mockFuelType}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Chỉnh sửa loại nhiên liệu/i)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Tên loại nhiên liệu/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Dầu Diesel DO 0.05S");
    expect(screen.getByRole("button", { name: /Cập nhật/i })).toBeInTheDocument();
  });
});
