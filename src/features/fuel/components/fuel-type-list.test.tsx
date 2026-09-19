import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FuelTypeList } from "./fuel-type-list";

vi.mock("../actions", () => ({
  createFuelTypeAction: vi.fn(),
  updateFuelTypeAction: vi.fn(),
  toggleFuelTypeActiveAction: vi.fn(),
  deleteFuelTypeAction: vi.fn(),
}));

describe("FuelTypeList Component", () => {
  const mockFuelTypes = [
    {
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
    },
    {
      id: "ft-2",
      name: "Nhớt động cơ 15W-40",
      code: "NHOT_15W40",
      unit: "can",
      current_stock: 5,
      min_stock: 10,
      description: "Nhớt thay máy",
      is_active: true,
      created_at: "",
      updated_at: "",
    },
  ];

  it("renders table with fuel types and KPI cards", () => {
    render(<FuelTypeList fuelTypes={mockFuelTypes} />);

    expect(screen.getByText("Danh mục Loại Dầu & Nhiên liệu")).toBeInTheDocument();
    expect(screen.getByText("Dầu Diesel DO 0.05S")).toBeInTheDocument();
    expect(screen.getByText("DIESEL_DO_005")).toBeInTheDocument();
    expect(screen.getByText("Nhớt động cơ 15W-40")).toBeInTheDocument();

    // Alert badge for low stock on ft-2 (5 <= 10)
    expect(screen.getAllByText(/Sắp hết/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when list is empty", () => {
    render(<FuelTypeList fuelTypes={[]} />);

    expect(screen.getByText("Chưa có loại nhiên liệu nào trong hệ thống")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tạo loại dầu đầu tiên/i })).toBeInTheDocument();
  });

  it("filters fuel types when searching", () => {
    render(<FuelTypeList fuelTypes={mockFuelTypes} />);

    const searchInput = screen.getByPlaceholderText(/Tìm kiếm theo tên/i);
    fireEvent.change(searchInput, { target: { value: "Diesel" } });

    expect(screen.getByText("Dầu Diesel DO 0.05S")).toBeInTheDocument();
    expect(screen.queryByText("Nhớt động cơ 15W-40")).not.toBeInTheDocument();
  });
});
