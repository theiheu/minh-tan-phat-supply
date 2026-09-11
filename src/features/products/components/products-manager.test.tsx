import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductsManager } from "./products-manager";
import type { AdminProductRow } from "../types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    refresh: vi.fn(),
  })),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>
      {children}
    </a>
  ),
}));

const mockCategories = [
  { id: "cat-1", name: "Cám & Thức ăn" },
  { id: "cat-2", name: "Thuốc thú y" },
];

const mockProducts: AdminProductRow[] = [
  {
    id: "prod-1",
    name: "Cám đẻ CP 514",
    description: "Cám gà đẻ trứng",
    images: [],
    options: [],
    categoryId: "cat-1",
    categoryName: "Cám & Thức ăn",
    createdAt: "2026-03-01T00:00:00.000Z",
    variants: [
      {
        id: "var-1",
        productId: "prod-1",
        attributes: { size: "25kg" },
        label: "Bao 25kg",
        unit: "bao",
        quantity: 100,
        price: 320000,
        minStock: 10,
        isTrackableLot: false,
        isDefault: true,
        images: [],
        isComposite: false,
        components: [],
      },
    ],
    isKit: false,
    totalStock: 100,
  },
];

describe("ProductsManager", () => {
  it("renders page header with title, action button, ListFilters, Card, and Table identical to vehicles tab", () => {
    render(
      <ProductsManager
        products={mockProducts}
        categories={mockCategories}
        page={1}
        totalPages={1}
        filters={{
          q: "cám",
          category: "cat-1",
          sort: "name",
          order: "asc",
        }}
      />,
    );

    // Page title and description
    expect(screen.getByRole("heading", { level: 1, name: "Vật tư" })).toBeInTheDocument();
    expect(
      screen.getByText("Quản lý danh mục, quy cách, linh kiện và tồn kho vật tư."),
    ).toBeInTheDocument();

    // Top right "Thêm vật tư" button
    expect(screen.getByRole("button", { name: /Thêm vật tư/i })).toBeInTheDocument();

    // ListFilters
    const searchInputs = screen.getAllByPlaceholderText("Tìm vật tư…");
    expect(searchInputs.length).toBeGreaterThan(0);
    expect((searchInputs[0] as HTMLInputElement).value).toBe("cám");

    // Card title
    expect(screen.getByText("Danh sách vật tư")).toBeInTheDocument();

    // Table data
    expect(screen.getByText("Cám đẻ CP 514")).toBeInTheDocument();
    expect(screen.getByText("Bao 25kg")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders empty state with dashed container when products list is empty", () => {
    render(
      <ProductsManager
        products={[]}
        categories={mockCategories}
        page={1}
        totalPages={1}
        filters={{
          q: "",
          category: "",
          sort: "name",
          order: "asc",
        }}
      />,
    );

    expect(screen.getByText("Chưa có vật tư")).toBeInTheDocument();
    expect(
      screen.getByText("Thêm vật tư đầu tiên để bắt đầu quản lý kho."),
    ).toBeInTheDocument();
  });
});
