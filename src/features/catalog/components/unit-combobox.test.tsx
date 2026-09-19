import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UnitCombobox } from "./unit-combobox";
import type { CatalogUnit } from "../domain/types";

describe("UnitCombobox component", () => {
  const mockUnits: CatalogUnit[] = [
    { id: "unit-1", code: "cai", name: "Cái", symbol: "cái", dimension: "count", factorToReference: 1, decimalScale: 0 },
    { id: "unit-2", code: "hop", name: "Hộp", symbol: "hộp", dimension: "package", factorToReference: 1, decimalScale: 0 },
    { id: "unit-3", code: "thung", name: "Thùng", symbol: "thùng", dimension: "package", factorToReference: 1, decimalScale: 0 },
    { id: "unit-4", code: "kg", name: "Kg", symbol: "kg", dimension: "mass", factorToReference: 1, decimalScale: 3 },
  ];

  it("renders with selected unit name cleanly without symbol parentheses", () => {
    render(
      <UnitCombobox
        value="unit-2"
        onChange={vi.fn()}
        units={mockUnits}
      />
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("Hộp");
    // Ensure no parentheses like "Hộp (hộp)"
    expect(input.value).not.toContain("(");
  });

  it("opens dropdown and lists existing units on click or focus", () => {
    render(
      <UnitCombobox
        value=""
        onChange={vi.fn()}
        units={mockUnits}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Cái")).toBeInTheDocument();
    expect(screen.getByText("Hộp")).toBeInTheDocument();
    expect(screen.getByText("Thùng")).toBeInTheDocument();
    expect(screen.getByText("Kg")).toBeInTheDocument();
  });

  it("filters existing units when typing", () => {
    render(
      <UnitCombobox
        value=""
        onChange={vi.fn()}
        units={mockUnits}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "thung" } });

    expect(screen.getByText("Thùng")).toBeInTheDocument();
    expect(screen.queryByText("Cái")).not.toBeInTheDocument();
  });

  it("calls onChange with unitId when an existing unit is clicked", () => {
    const handleChange = vi.fn();
    render(
      <UnitCombobox
        value=""
        onChange={handleChange}
        units={mockUnits}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    const thungOption = screen.getByText("Thùng");
    fireEvent.click(thungOption);

    expect(handleChange).toHaveBeenCalledWith("unit-3", expect.objectContaining({ id: "unit-3", name: "Thùng" }));
  });

  it("allows entering a new custom unit name and selecting 'Sử dụng đơn vị mới'", () => {
    const handleChange = vi.fn();
    render(
      <UnitCombobox
        value=""
        onChange={handleChange}
        units={mockUnits}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Tấm" } });

    // Should show option to use new unit
    const customBtn = screen.getByText(/Sử dụng đơn vị mới/i);
    expect(customBtn).toBeInTheDocument();

    fireEvent.click(customBtn);
    expect(handleChange).toHaveBeenCalledWith("Tấm", undefined);
  });

  it("confirms custom unit on blur or enter", () => {
    const handleChange = vi.fn();
    render(
      <UnitCombobox
        value=""
        onChange={handleChange}
        units={mockUnits}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Kiện lớn" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleChange).toHaveBeenCalledWith("Kiện lớn", undefined);
  });
});
