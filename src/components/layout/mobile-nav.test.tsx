import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileNav } from "./mobile-nav";
import type { Profile } from "@/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe("MobileNav", () => {
  it("renders evenly distributed flex tabs for requester role (4 items total including Thêm)", () => {
    const requesterProfile = {
      id: "user-req",
      name: "Người yêu cầu",
      role: "requester",
      zone_id: null,
    } as Profile;

    render(<MobileNav profile={requesterProfile} />);

    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("flex");
    expect(nav.className).not.toContain("grid-cols-5");

    // Requester has 3 nav groups (Trang chủ, Yêu cầu vật tư, Vật tư hỏng) + 1 button "Thêm"
    expect(screen.getByText("Trang chủ")).toBeInTheDocument();
    expect(screen.getByText("Yêu cầu vật tư")).toBeInTheDocument();
    expect(screen.getByText("Vật tư hỏng")).toBeInTheDocument();
    expect(screen.getByText("Thêm")).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.className).toContain("flex-1");
      expect(link.className).toContain("min-w-0");
    }

    const moreButton = screen.getByRole("button", { name: "Xem thêm" });
    expect(moreButton.className).toContain("flex-1");
    expect(moreButton.className).toContain("min-w-0");
  });

  it("renders evenly distributed flex tabs for warehouse role (5 items total including Thêm)", () => {
    const warehouseProfile = {
      id: "user-wh",
      name: "Quản kho",
      role: "warehouse",
      zone_id: null,
    } as Profile;

    render(<MobileNav profile={warehouseProfile} />);

    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("flex");

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link.className).toContain("flex-1");
      expect(link.className).toContain("min-w-0");
    }

    const moreButton = screen.getByRole("button", { name: "Xem thêm" });
    expect(moreButton.className).toContain("flex-1");
  });
});
