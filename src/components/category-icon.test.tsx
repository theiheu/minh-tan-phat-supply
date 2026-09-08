import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CategoryIcon, isImageIcon } from "./category-icon";

describe("isImageIcon", () => {
  it("detects image URLs and data URLs", () => {
    expect(isImageIcon("http://example.com/icon.png")).toBe(true);
    expect(isImageIcon("https://example.com/icon.png")).toBe(true);
    expect(isImageIcon("/icons/tool.png")).toBe(true);
    expect(isImageIcon("data:image/png;base64,...")).toBe(true);
    expect(isImageIcon("wrench")).toBe(false);
    expect(isImageIcon(null)).toBe(false);
    expect(isImageIcon(undefined)).toBe(false);
  });
});

describe("CategoryIcon", () => {
  it("renders an img tag when value is an image URL", () => {
    const { container } = render(<CategoryIcon value="https://example.com/category.png" className="size-6" />);
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/category.png");
  });

  it("falls back to Lucide icon when image fails to load", () => {
    const { container } = render(<CategoryIcon value="https://example.com/broken-category.png" className="size-6" />);
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    fireEvent.error(img!);

    // img is gone, replaced by lucide svg icon
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
