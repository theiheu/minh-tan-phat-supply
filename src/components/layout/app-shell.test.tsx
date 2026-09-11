import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";
import { useUIStore } from "@/stores/ui-store";
import type { Profile } from "@/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/stores/cart-store", () => ({
  useCartStore: (selector: (state: { items: never[] }) => unknown) => selector({ items: [] }),
}));

vi.mock("./notification-bell", () => ({ NotificationBell: () => <div /> }));
vi.mock("./sign-out-button", () => ({ SignOutButton: () => <button>Đăng xuất</button> }));
vi.mock("@/features/products/components/cart-drawer", () => ({ CartDrawer: () => null }));
vi.mock("@/components/slip-detail-modal", () => ({ SlipDetailModal: () => null }));

const profile = {
  id: "user-1",
  name: "Quản lý kho",
  role: "manager",
  zone_id: null,
} as Profile;

describe("AppShell mobile drawer header", () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ mobileDrawerOpen: true });
  });

  it("renders mobile drawer header aligned to the left with flex-row and justify-start", () => {
    render(
      <AppShell profile={profile}>
        <div>Main content</div>
      </AppShell>,
    );

    const sheetTitles = screen.getAllByText("MINH TÂN PHÁT");
    expect(sheetTitles.length).toBeGreaterThan(0);

    const sheetHeader = document.querySelector('[data-slot="sheet-header"]');
    expect(sheetHeader).not.toBeNull();
    expect(sheetHeader?.className).toContain("flex-row");
    expect(sheetHeader?.className).toContain("justify-start");
    expect(sheetHeader?.className).toContain("text-left");
  });
});
