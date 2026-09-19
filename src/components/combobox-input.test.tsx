import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComboboxInput } from "./combobox-input";

const mockOptions = [
  { value: "sup-1", label: "Nhà cung cấp Minh Phát" },
  { value: "sup-2", label: "Công ty Cổ phần Tiến Đạt" },
  { value: "sup-3", label: "Petrolimex Sông Bé" },
];

describe("ComboboxInput", () => {
  it("renders with placeholder when no value is selected", () => {
    render(
      <ComboboxInput
        value=""
        onChange={vi.fn()}
        options={mockOptions}
        placeholder="Chọn nhà cung cấp…"
      />
    );
    const input = screen.getByPlaceholderText("Chọn nhà cung cấp…");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("displays the selected option label", () => {
    render(
      <ComboboxInput
        value="sup-1"
        onChange={vi.fn()}
        options={mockOptions}
        placeholder="Chọn nhà cung cấp…"
      />
    );
    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Nhà cung cấp Minh Phát");
  });

  it("shows all options when focusing an input that already has a selected value", () => {
    render(
      <ComboboxInput
        value="sup-1"
        onChange={vi.fn()}
        options={mockOptions}
        placeholder="Chọn nhà cung cấp…"
      />
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    expect(screen.getByText("Nhà cung cấp Minh Phát")).toBeInTheDocument();
    expect(screen.getByText("Công ty Cổ phần Tiến Đạt")).toBeInTheDocument();
    expect(screen.getByText("Petrolimex Sông Bé")).toBeInTheDocument();
  });

  it("filters options when user types a search query", () => {
    render(
      <ComboboxInput
        value=""
        onChange={vi.fn()}
        options={mockOptions}
        placeholder="Chọn nhà cung cấp…"
      />
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Tiến Đạt" } });

    expect(screen.getByText("Công ty Cổ phần Tiến Đạt")).toBeInTheDocument();
    expect(screen.queryByText("Nhà cung cấp Minh Phát")).not.toBeInTheDocument();
    expect(screen.queryByText("Petrolimex Sông Bé")).not.toBeInTheDocument();
  });

  it("calls onChange when an option is clicked", () => {
    const handleChange = vi.fn();
    render(
      <ComboboxInput
        value=""
        onChange={handleChange}
        options={mockOptions}
        placeholder="Chọn nhà cung cấp…"
      />
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    const option = screen.getByText("Petrolimex Sông Bé");
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith("sup-3");
  });
});
