import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListFilters } from "./list-filters";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

describe("ListFilters", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("preserves extra parameters like tab in query string on filter apply", () => {
    render(
      <ListFilters
        basePath="/fuel"
        filters={[
          {
            param: "fuelTypeId",
            label: "Loại dầu",
            options: [{ value: "fuel-1", label: "Dầu DO" }],
          },
        ]}
        initial={{
          tab: "reports",
          fuelTypeId: "fuel-1",
        }}
      />
    );

    const submitBtns = screen.getAllByRole("button", { name: "Lọc" });
    fireEvent.click(submitBtns[0]);

    expect(mockPush).toHaveBeenCalledWith("/fuel?tab=reports&fuelTypeId=fuel-1");
  });

  it("preserves extra parameters on reset", () => {
    render(
      <ListFilters
        basePath="/fuel"
        filters={[
          {
            param: "fuelTypeId",
            label: "Loại dầu",
            options: [{ value: "fuel-1", label: "Dầu DO" }],
          },
        ]}
        initial={{
          tab: "reports",
          fuelTypeId: "fuel-1",
        }}
      />
    );

    const resetBtn = screen.getByRole("button", { name: "Xóa lọc" });
    fireEvent.click(resetBtn);

    expect(mockPush).toHaveBeenCalledWith("/fuel?tab=reports");
  });

  it("hides search input when showSearch is false", () => {
    render(
      <ListFilters
        basePath="/fuel"
        showSearch={false}
        filters={[
          {
            param: "vehicleId",
            label: "Phương tiện",
            options: [{ value: "v-1", label: "Xe 1" }],
          },
        ]}
        initial={{
          tab: "reports",
        }}
      />
    );

    expect(screen.queryByPlaceholderText("Tìm kiếm…")).toBeNull();
  });

  it("opens mobile filter sheet when clicking mobile filter button", () => {
    render(
      <ListFilters
        basePath="/repairs"
        title="Lọc sửa chữa"
        filters={[
          {
            param: "status",
            label: "Trạng thái",
            options: [
              { value: "pending", label: "Chờ duyệt" },
              { value: "completed", label: "Hoàn thành" },
            ],
          },
        ]}
      />
    );

    // Click mobile filter button (the second "Lọc" button with SlidersHorizontal)
    const filterButtons = screen.getAllByRole("button", { name: /Lọc/i });
    // filterButtons[1] is the mobile trigger button
    fireEvent.click(filterButtons[1]);

    // Sheet title should appear
    expect(screen.getByText("Lọc sửa chữa")).toBeDefined();
    // Status select label should be visible
    expect(screen.getByText("Trạng thái")).toBeDefined();
  });
});
