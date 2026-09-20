import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MetabaseBiTab } from "./metabase-bi-tab";
import * as actions from "../actions";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

vi.mock("../actions", () => ({
  getMetabaseDashboardAction: vi.fn(),
}));

describe("MetabaseBiTab component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (actions.getMetabaseDashboardAction as any).mockResolvedValue({
      embedUrl: "http://192.168.1.4:8100/embed/dashboard/mock-token#bordered=true",
      directUrl: "http://192.168.1.4:8100/dashboard/1",
      siteUrl: "http://192.168.1.4:8100",
      dashboard: {
        id: "executive-overview",
        numericId: 1,
        title: "Tổng Quan Ban Giám Đốc (Executive KPIs)",
        category: "executive",
        description: "Chỉ số tổng hợp MTD",
        recommendedRole: ["superuser", "owner"],
      },
      dashboards: [],
    });
  });

  it("renders Metabase header, badge, and action buttons", async () => {
    render(<MetabaseBiTab />);

    await waitFor(() => {
      expect(screen.getByText("Phân tích chuyên sâu với Metabase BI")).toBeDefined();
      expect(screen.getByText("Làm mới")).toBeDefined();
      expect(screen.getByText("Toàn màn hình")).toBeDefined();
    });
  });

  it("renders dashboard selector navigation pills", async () => {
    render(<MetabaseBiTab />);

    await waitFor(() => {
      expect(screen.getByText("Tổng Quan Ban Giám Đốc (Executive KPIs)")).toBeDefined();
      expect(screen.getByText("Phân Bổ Chi Phí Theo Dãy Trại & Khu Vực")).toBeDefined();
      expect(screen.getByText("Trạm Bồn Dầu & Đội Xe Cơ Giới")).toBeDefined();
    });
  });

  it("switches dashboard on pill click", async () => {
    render(<MetabaseBiTab />);

    await waitFor(() => {
      expect(screen.getByText("Trạm Bồn Dầu & Đội Xe Cơ Giới")).toBeDefined();
    });

    const fuelPill = screen.getByText("Trạm Bồn Dầu & Đội Xe Cơ Giới");
    fireEvent.click(fuelPill);

    await waitFor(() => {
      expect(actions.getMetabaseDashboardAction).toHaveBeenCalledWith({
        dashboardId: "fuel-fleet",
      });
    });
  });

  it("toggles fullscreen mode", async () => {
    render(<MetabaseBiTab />);

    await waitFor(() => {
      expect(screen.getByText("Toàn màn hình")).toBeDefined();
    });

    const fullscreenBtn = screen.getByText("Toàn màn hình");
    fireEvent.click(fullscreenBtn);

    await waitFor(() => {
      expect(screen.getByText("Thu gọn")).toBeDefined();
    });

    const minimizeBtn = screen.getByText("Thu gọn");
    fireEvent.click(minimizeBtn);

    await waitFor(() => {
      expect(screen.getByText("Toàn màn hình")).toBeDefined();
    });
  });
});
