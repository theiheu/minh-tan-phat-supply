import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  ReportDateFilters,
  getPresetRange,
  type StockLocationOption,
} from "./report-date-filters";
import type { DatePreset } from "../types";

describe("getPresetRange helper", () => {
  it("calculates 'today' correctly", () => {
    const fixedDate = new Date(2026, 8, 8); // 2026-09-08
    const range = getPresetRange("today", fixedDate);
    expect(range).toEqual({
      from: "2026-09-08",
      to: "2026-09-08",
    });
  });

  it("calculates '7days' correctly (6 days ago to today)", () => {
    const fixedDate = new Date(2026, 8, 8); // 2026-09-08
    const range = getPresetRange("7days", fixedDate);
    expect(range).toEqual({
      from: "2026-09-02",
      to: "2026-09-08",
    });
  });

  it("calculates 'this_month' correctly", () => {
    const fixedDate = new Date(2026, 8, 8); // 2026-09-08
    const range = getPresetRange("this_month", fixedDate);
    expect(range).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("calculates 'last_month' correctly", () => {
    const fixedDate = new Date(2026, 8, 8); // 2026-09-08
    const range = getPresetRange("last_month", fixedDate);
    expect(range).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("calculates 'last_month' across year boundary (January)", () => {
    const fixedDate = new Date(2026, 0, 15); // 2026-01-15
    const range = getPresetRange("last_month", fixedDate);
    expect(range).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("calculates 'this_quarter' correctly for all 4 quarters", () => {
    // Q1: Feb 10, 2026
    const q1 = getPresetRange("this_quarter", new Date(2026, 1, 10));
    expect(q1).toEqual({ from: "2026-01-01", to: "2026-03-31" });

    // Q2: May 15, 2026
    const q2 = getPresetRange("this_quarter", new Date(2026, 4, 15));
    expect(q2).toEqual({ from: "2026-04-01", to: "2026-06-30" });

    // Q3: Sep 8, 2026
    const q3 = getPresetRange("this_quarter", new Date(2026, 8, 8));
    expect(q3).toEqual({ from: "2026-07-01", to: "2026-09-30" });

    // Q4: Nov 20, 2026
    const q4 = getPresetRange("this_quarter", new Date(2026, 10, 20));
    expect(q4).toEqual({ from: "2026-10-01", to: "2026-12-31" });
  });

  it("calculates 'this_year' correctly", () => {
    const fixedDate = new Date(2026, 8, 8); // 2026-09-08
    const range = getPresetRange("this_year", fixedDate);
    expect(range).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("calculates 'custom' fallback correctly", () => {
    const fixedDate = new Date(2026, 8, 8);
    const range = getPresetRange("custom", fixedDate);
    expect(range).toEqual({
      from: "2026-09-08",
      to: "2026-09-08",
    });
  });
});

describe("ReportDateFilters component", () => {
  const mockLocations: StockLocationOption[] = [
    { id: "loc-main", code: "KHO_CHINH", name: "Kho Chính" },
    { id: "loc-defect", code: "KHO_HONG", name: "Kho Hỏng" },
    { id: "loc-fuel", code: "KHO_DAU", name: "Kho Dầu" },
  ];

  const defaultProps = {
    value: {
      from: "2026-09-01",
      to: "2026-09-30",
      preset: "this_month" as DatePreset,
      locationId: undefined,
    },
    onChange: vi.fn(),
    locations: mockLocations,
  };

  it("renders preset buttons, date summary badge, and location selector while collapsing custom inputs by default", () => {
    render(<ReportDateFilters {...defaultProps} />);

    // Preset buttons
    expect(screen.getByRole("button", { name: "Hôm nay" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Hôm qua" })).toBeDefined();
    expect(screen.getByRole("button", { name: "7 ngày qua" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Tháng này" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Tháng trước" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Quý này" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Năm nay" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Tùy chọn ngày" })).toBeDefined();

    // Date summary badge
    expect(screen.getByText("01/09/2026 – 30/09/2026")).toBeDefined();

    // Custom date inputs are collapsed by default
    expect(screen.queryByLabelText("Từ ngày")).toBeNull();
    expect(screen.queryByLabelText("Đến ngày")).toBeNull();

    // Location selector
    const locationSelect = screen.getByLabelText("Kho") as HTMLSelectElement;
    expect(locationSelect.value).toBe("");
    expect(screen.getByRole("option", { name: "Tất cả kho" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Kho Chính (KHO_CHINH)" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Kho Hỏng (KHO_HONG)" })).toBeDefined();
  });

  it("expands custom date inputs when preset is 'custom'", () => {
    render(
      <ReportDateFilters
        {...defaultProps}
        value={{
          ...defaultProps.value,
          preset: "custom",
        }}
      />
    );

    const fromInput = screen.getByLabelText("Từ ngày") as HTMLInputElement;
    const toInput = screen.getByLabelText("Đến ngày") as HTMLInputElement;
    expect(fromInput.value).toBe("2026-09-01");
    expect(toInput.value).toBe("2026-09-30");
  });

  it("calls onChange when preset button is clicked", () => {
    const onChange = vi.fn();
    render(<ReportDateFilters {...defaultProps} onChange={onChange} />);

    const thisYearBtn = screen.getByRole("button", { name: "Năm nay" });
    fireEvent.click(thisYearBtn);

    const now = new Date();
    const expected = getPresetRange("this_year", now);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      from: expected.from,
      to: expected.to,
      preset: "this_year",
      locationId: undefined,
    });
  });

  it("preserves locationId when changing date preset", () => {
    const onChange = vi.fn();
    render(
      <ReportDateFilters
        {...defaultProps}
        value={{
          ...defaultProps.value,
          locationId: "loc-main",
        }}
        onChange={onChange}
      />
    );

    const todayBtn = screen.getByRole("button", { name: "Hôm nay" });
    fireEvent.click(todayBtn);

    const now = new Date();
    const expected = getPresetRange("today", now);

    expect(onChange).toHaveBeenCalledWith({
      from: expected.from,
      to: expected.to,
      preset: "today",
      locationId: "loc-main",
    });
  });

  it("sets preset to custom when clicking 'Tùy chọn ngày' button", () => {
    const onChange = vi.fn();
    render(<ReportDateFilters {...defaultProps} onChange={onChange} />);

    const customBtn = screen.getByRole("button", { name: "Tùy chọn ngày" });
    fireEvent.click(customBtn);

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-09-01",
      to: "2026-09-30",
      preset: "custom",
      locationId: undefined,
    });
  });

  it("updates from date and switches preset to custom on manual date change", () => {
    const onChange = vi.fn();
    render(
      <ReportDateFilters
        {...defaultProps}
        value={{ ...defaultProps.value, preset: "custom" }}
        onChange={onChange}
      />
    );

    const fromInput = screen.getByLabelText("Từ ngày");
    fireEvent.change(fromInput, { target: { value: "2026-09-10" } });

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-09-10",
      to: "2026-09-30",
      preset: "custom",
      locationId: undefined,
    });
  });

  it("updates to date and switches preset to custom on manual date change", () => {
    const onChange = vi.fn();
    render(
      <ReportDateFilters
        {...defaultProps}
        value={{ ...defaultProps.value, preset: "custom" }}
        onChange={onChange}
      />
    );

    const toInput = screen.getByLabelText("Đến ngày");
    fireEvent.change(toInput, { target: { value: "2026-09-25" } });

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-09-01",
      to: "2026-09-25",
      preset: "custom",
      locationId: undefined,
    });
  });

  it("calls onChange when selecting a specific location", () => {
    const onChange = vi.fn();
    render(<ReportDateFilters {...defaultProps} onChange={onChange} />);

    const locationSelect = screen.getByLabelText("Kho");
    fireEvent.change(locationSelect, { target: { value: "loc-defect" } });

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-09-01",
      to: "2026-09-30",
      preset: "this_month",
      locationId: "loc-defect",
    });
  });

  it("calls onChange with undefined locationId when selecting 'Tất cả kho'", () => {
    const onChange = vi.fn();
    render(
      <ReportDateFilters
        {...defaultProps}
        value={{
          ...defaultProps.value,
          locationId: "loc-main",
        }}
        onChange={onChange}
      />
    );

    const locationSelect = screen.getByLabelText("Kho");
    fireEvent.change(locationSelect, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-09-01",
      to: "2026-09-30",
      preset: "this_month",
      locationId: undefined,
    });
  });

  it("hides location select when showLocation is false", () => {
    render(<ReportDateFilters {...defaultProps} showLocation={false} />);

    expect(screen.queryByLabelText("Kho")).toBeNull();
  });
});
