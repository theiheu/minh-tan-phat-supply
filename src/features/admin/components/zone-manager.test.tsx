import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ZoneManager, type ZoneItem } from "./zone-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../actions", () => ({
  saveZoneWithSubZones: vi.fn().mockResolvedValue(undefined),
  deleteZone: vi.fn().mockResolvedValue(undefined),
}));

const sampleZones: ZoneItem[] = [
  {
    id: "zone-1",
    name: "Khu 1",
    description: "Trại gà thịt A",
    subZones: [
      { id: "sub-1", name: "Trại 1", display_order: 0 },
      { id: "sub-2", name: "Trại 2", display_order: 1 },
      { id: "sub-3", name: "Trại 3", display_order: 2 },
    ],
  },
  {
    id: "zone-4",
    name: "Khu 4",
    description: "Khu xử lý chất thải",
    subZones: [
      { id: "sub-4", name: "Xưởng phân", display_order: 0 },
      { id: "sub-5", name: "Trạm bơm", display_order: 1 },
    ],
  },
  {
    id: "zone-empty",
    name: "Khu Trống",
    description: "Chưa phân trại",
    subZones: [],
  },
];

describe("ZoneManager Component", () => {
  it("renders table header and zones with sub-zones badges", () => {
    render(<ZoneManager zones={sampleZones} page={1} totalPages={1} />);

    expect(screen.getByText("Khu vực & Trại trực thuộc")).toBeInTheDocument();
    expect(screen.getByText("Khu 1")).toBeInTheDocument();
    expect(screen.getByText("Trại gà thịt A")).toBeInTheDocument();
    expect(screen.getByText("Trại 1")).toBeInTheDocument();
    expect(screen.getByText("Trại 2")).toBeInTheDocument();
    expect(screen.getByText("Trại 3")).toBeInTheDocument();

    expect(screen.getByText("Khu 4")).toBeInTheDocument();
    expect(screen.getByText("Xưởng phân")).toBeInTheDocument();
    expect(screen.getByText("Trạm bơm")).toBeInTheDocument();

    expect(screen.getByText("Chưa có trại/xưởng con")).toBeInTheDocument();
  });

  it("filters zones and sub-zones by search input", () => {
    render(<ZoneManager zones={sampleZones} page={1} totalPages={1} />);

    const searchInput = screen.getByPlaceholderText("Tìm kiếm khu vực, trại, xưởng...");
    fireEvent.change(searchInput, { target: { value: "Xưởng phân" } });

    expect(screen.queryByText("Khu 1")).not.toBeInTheDocument();
    expect(screen.getByText("Khu 4")).toBeInTheDocument();
    expect(screen.getByText("Xưởng phân")).toBeInTheDocument();
  });

  it("opens create dialog and allows adding sub-zone tags", () => {
    render(<ZoneManager zones={sampleZones} page={1} totalPages={1} />);

    const addBtn = screen.getByRole("button", { name: /Thêm khu vực/i });
    fireEvent.click(addBtn);

    expect(screen.getByText("Thêm khu vực mới")).toBeInTheDocument();

    const subZoneInput = screen.getByPlaceholderText("Nhập tên trại/xưởng (VD: Trại 1)...");
    const addSubZoneBtn = screen.getByRole("button", { name: /Thêm/i });

    fireEvent.change(subZoneInput, { target: { value: "Trại Úm 1" } });
    fireEvent.click(addSubZoneBtn);

    expect(screen.getByText("Trại Úm 1")).toBeInTheDocument();

    // Add another via Enter key
    fireEvent.change(subZoneInput, { target: { value: "Trại Úm 2" } });
    fireEvent.keyDown(subZoneInput, { key: "Enter", code: "Enter" });
    expect(screen.getByText("Trại Úm 2")).toBeInTheDocument();
  });
});
