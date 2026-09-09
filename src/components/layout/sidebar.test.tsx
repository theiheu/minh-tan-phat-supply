import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useUIStore } from "@/stores/ui-store";
import type { Profile } from "@/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>{children}</a>
  ),
}));

vi.mock("@/stores/cart-store", () => ({
  useCartStore: (selector: (state: { items: never[] }) => unknown) => selector({ items: [] }),
}));

vi.mock("./notification-bell", () => ({ NotificationBell: () => <div /> }));
vi.mock("./sign-out-button", () => ({ SignOutButton: () => <button>Đăng xuất</button> }));

const profile = {
  id: "user-1",
  name: "Quản lý kho",
  role: "manager",
  zone_id: null,
} as Profile;

describe("desktop sidebar collapse", () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ sidebarCollapsed: false });
  });

  it("toggles sidebar from the desktop topbar button", () => {
    render(
      <>
        <Sidebar profile={profile} />
        <Topbar />
      </>,
    );

    expect(screen.getByText("MINH TÂN PHÁT")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Thu gọn thanh bên" }));

    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    expect(screen.queryByText("MINH TÂN PHÁT")).toBeNull();
    expect(screen.getByRole("button", { name: "Mở rộng thanh bên" })).toBeDefined();
  });

  it("renders the farm logo without outer border/ring box and with size-11 dimensions", () => {
    render(<Sidebar profile={profile} />);

    const logoContainer = screen.getByLabelText("Trại gà Minh Tân Phát");
    expect(logoContainer.className).not.toContain("border");
    expect(logoContainer.className).not.toContain("ring-1");
    expect(logoContainer.className).toContain("size-11");
  });

  it("keeps only the logo badge when collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true });
    render(<Sidebar profile={profile} />);

    expect(screen.getByAltText("Logo Trại gà Minh Tân Phát")).toBeDefined();
    expect(screen.queryByText("TRẠI GÀ")).toBeNull();
    expect(screen.queryByText("MINH TÂN PHÁT")).toBeNull();
  });

  it("persists collapsed preference to localStorage", () => {
    useUIStore.getState().setSidebarCollapsed(true);

    const stored = JSON.parse(localStorage.getItem("mtp-ui-preferences") ?? "{}");
    expect(stored.state.sidebarCollapsed).toBe(true);
  });
});
