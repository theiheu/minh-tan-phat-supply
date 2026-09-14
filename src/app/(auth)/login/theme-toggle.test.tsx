import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: mockSetTheme,
  }),
}));

describe("ThemeToggle component", () => {
  it("renders theme toggle button and switches theme on click", () => {
    render(<ThemeToggle />);

    const toggleBtn = screen.getByRole("button", { name: /Chuyển sang giao diện tối/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});
