import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/types";
import { useUIStore } from "@/stores/ui-store";
import { ExecutiveDashboardView } from "./views/executive-dashboard-view";
import { AccountantDashboardView } from "./views/accountant-dashboard-view";
import { WarehouseDashboardView } from "./views/warehouse-dashboard-view";
import { TechnicianDashboardView } from "./views/technician-dashboard-view";
import { RequesterDashboardView } from "./views/requester-dashboard-view";
import { DriverDashboardView } from "./views/driver-dashboard-view";
import type {
  ExecutiveDashboardData,
  AccountantDashboardData,
  WarehouseDashboardData,
  TechnicianDashboardData,
  RequesterDashboardData,
  DriverDashboardData,
} from "@/features/dashboard/server/get-role-dashboard-data";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/dashboard",
}));

describe("Role-Tailored Dashboard Views", () => {
  const baseProfile: Profile = {
    id: "user-123",
    name: "Nguyễn Văn Admin",
    username: "admin",
    email: "admin@minhtanphat.com",
    role: "owner",
    zone_id: null,
    sub_zone_id: null,
    is_active: true,
    is_protected: false,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };

  it("renders ExecutiveDashboardView correctly for owner/superuser", () => {
    const execData: ExecutiveDashboardData = {
      metrics: {
        totalProducts: 120,
        pendingApprovalsCount: 3,
        monthIssuesCount: 45,
        weekFuelDispensesCount: 12,
      },
      pendingLiquidations: [
        {
          id: "liq-1",
          code: "TL-001",
          type: "liquidation",
          status: "pending",
          statusLabel: "Chờ duyệt",
          createdAt: "2026-09-20T08:00:00Z",
          actorName: "Thủ kho",
          description: "Thanh lý quạt hỏng",
        },
      ],
      pendingStocktakes: [],
      lowStockItems: [
        {
          id: "sku-1",
          skuCode: "SKU-001",
          productName: "Bóng đèn sưởi hồng ngoại",
          currentStock: 2,
          minStock: 10,
          unit: "Cái",
        },
      ],
      recentActivities: [],
    };

    render(<ExecutiveDashboardView profile={{ ...baseProfile, role: "owner" }} data={execData} />);

    expect(screen.getByText(/Xin chào, Nguyễn Văn Admin/i)).toBeInTheDocument();
    expect(screen.getByText("Báo cáo tổng hợp")).toBeInTheDocument();
    expect(screen.getByText("Tổng loại vật tư")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getAllByText("TL-001").length).toBeGreaterThan(0);
    expect(screen.getByText(/Bóng đèn sưởi hồng ngoại/i)).toBeInTheDocument();
  });

  it("renders AccountantDashboardView correctly for accountant", () => {
    const accData: AccountantDashboardData = {
      metrics: {
        draftReceiptsCount: 4,
        pendingLiquidationsCount: 1,
        monthIssuesCount: 18,
        pendingStocktakesCount: 0,
      },
      pendingReceipts: [
        {
          id: "rec-1",
          code: "PNK-009",
          type: "receipt",
          status: "draft",
          statusLabel: "Bản nháp",
          createdAt: "2026-09-20T09:00:00Z",
          actorName: "NCC Cáp Điện ABC",
          description: "Dây điện cadivi",
        },
      ],
      recentIssues: [],
      pendingLiquidations: [],
    };

    render(
      <AccountantDashboardView
        profile={{ ...baseProfile, role: "accountant", name: "Trần Thị Kế Toán" }}
        data={accData}
      />
    );

    expect(screen.getByText(/Xin chào, Trần Thị Kế Toán/i)).toBeInTheDocument();
    expect(screen.getByText("Kế Toán Kho & Nội Bộ")).toBeInTheDocument();
    expect(screen.getByText("Phiếu nhập nháp / Chờ ghi")).toBeInTheDocument();
    expect(screen.getAllByText("PNK-009").length).toBeGreaterThan(0);
  });

  it("renders WarehouseDashboardView correctly for warehouse", () => {
    const whData: WarehouseDashboardData = {
      metrics: {
        approvedRequisitionsCount: 2,
        draftReceiptsCount: 1,
        pendingExchangesCount: 1,
        lowStockCount: 1,
      },
      fulfillmentQueue: [
        {
          id: "req-1",
          code: "YC-001",
          type: "requisition",
          status: "approved",
          statusLabel: "Đã duyệt",
          createdAt: "2026-09-20T07:00:00Z",
          actorName: "Kỹ thuật A",
          locationOrZone: "Khu A - Trại 1",
          description: "Cần 5 bao vôi khử trùng",
        },
      ],
      pendingReceipts: [],
      pendingExchanges: [],
      lowStockItems: [],
    };

    render(
      <WarehouseDashboardView
        profile={{ ...baseProfile, role: "warehouse", name: "Lê Văn Kho" }}
        data={whData}
      />
    );

    expect(screen.getByText(/Xin chào, Lê Văn Kho/i)).toBeInTheDocument();
    expect(screen.getByText("Quản Kho Tổng / Thủ Kho")).toBeInTheDocument();
    expect(screen.getByText("Nhập kho mới")).toBeInTheDocument();
    expect(screen.getAllByText("YC-001").length).toBeGreaterThan(0);
  });

  it("renders TechnicianDashboardView correctly for technician", () => {
    const techData: TechnicianDashboardData = {
      metrics: {
        pendingApprovalReqsCount: 2,
        activeRepairsCount: 1,
        stagingDefectsCount: 1,
        borrowedToolsCount: 4,
      },
      pendingRequisitions: [
        {
          id: "req-2",
          code: "YC-002",
          type: "requisition",
          status: "pending",
          statusLabel: "Chờ duyệt",
          createdAt: "2026-09-20T08:30:00Z",
          actorName: "Công nhân B",
          locationOrZone: "Khu B",
          description: "Cần rơ le nhiệt",
        },
      ],
      activeRepairs: [
        {
          id: "rep-1",
          code: "SC-001",
          type: "repair",
          status: "in_repair",
          statusLabel: "Đang sửa",
          createdAt: "2026-09-19T10:00:00Z",
          actorName: "Xưởng Quấn Motor Hùng",
          description: "Motor quạt thông gió 1.5kW",
        },
      ],
      stagingDefects: [],
    };

    render(
      <TechnicianDashboardView
        profile={{ ...baseProfile, role: "technician", name: "Phạm Kỹ Thuật" }}
        data={techData}
      />
    );

    expect(screen.getByText(/Xin chào, Phạm Kỹ Thuật/i)).toBeInTheDocument();
    expect(screen.getByText("Kỹ Thuật Trưởng / Quản Lý Khu")).toBeInTheDocument();
    expect(screen.getByText("Duyệt phiếu xin cấp")).toBeInTheDocument();
    expect(screen.getAllByText("YC-002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SC-001").length).toBeGreaterThan(0);
  });

  it("renders RequesterDashboardView correctly for requester with action items", () => {
    const reqData: RequesterDashboardData = {
      metrics: {
        myPendingCount: 1,
        readyToReceiveCount: 1,
        myBorrowedToolsCount: 2,
      },
      readyToReceiveList: [
        {
          id: "req-ready-1",
          code: "YC-099",
          type: "requisition",
          status: "issued",
          statusLabel: "Đã xuất kho",
          createdAt: "2026-09-20T09:00:00Z",
          description: "5 can sát trùng trại",
        },
      ],
      myRecentRequisitions: [],
      myBorrowedTools: [],
    };

    render(
      <RequesterDashboardView
        profile={{ ...baseProfile, role: "requester", name: "Nguyễn Văn Thợ" }}
        data={reqData}
      />
    );

    expect(screen.getByText(/Xin chào, Nguyễn Văn Thợ/i)).toBeInTheDocument();
    expect(screen.getByText("Xin cấp vật tư")).toBeInTheDocument();
    expect(screen.getByText("Mượn dụng cụ")).toBeInTheDocument();
    expect(screen.getByText("Báo hỏng thiết bị")).toBeInTheDocument();
    expect(screen.getByText(/Hàng đã xuất — Vui lòng nhận vật tư/i)).toBeInTheDocument();
    expect(screen.getByText("Xác nhận nhận hàng")).toBeInTheDocument();

    // Verify clicking "Xác nhận nhận hàng" or the ticket code opens the slip detail modal
    fireEvent.click(screen.getByText("Xác nhận nhận hàng"));
    expect(useUIStore.getState().slipModal).toEqual({
      type: "requisition",
      id: "req-ready-1",
    });

    // Reset and test clicking code
    useUIStore.getState().closeSlipModal();
    fireEvent.click(screen.getByText("YC-099"));
    expect(useUIStore.getState().slipModal).toEqual({
      type: "requisition",
      id: "req-ready-1",
    });
  });

  it("renders RequesterDashboardView with pagination for 'Lịch sử yêu cầu vật tư của tôi'", () => {
    const mockReqs = Array.from({ length: 12 }, (_, i) => ({
      id: `req-${i + 1}`,
      code: `YC-${String(i + 1).padStart(3, "0")}`,
      type: "requisition" as const,
      typeLabel: "Phiếu yêu cầu",
      status: "pending",
      statusLabel: "Chờ duyệt",
      createdAt: "2026-09-20T09:00:00Z",
      description: `Mục đích yêu cầu ${i + 1}`,
    }));

    const reqData: RequesterDashboardData = {
      metrics: {
        myPendingCount: 12,
        readyToReceiveCount: 0,
        myBorrowedToolsCount: 0,
      },
      readyToReceiveList: [],
      myRecentRequisitions: mockReqs,
      myBorrowedTools: [],
    };

    render(
      <RequesterDashboardView
        profile={{ ...baseProfile, role: "requester", name: "Nguyễn Văn Thợ" }}
        data={reqData}
      />
    );

    // Header title and count badge
    expect(screen.getByText("Lịch sử yêu cầu vật tư của tôi")).toBeInTheDocument();
    expect(screen.getAllByText("12").length).toBeGreaterThan(0);

    // Page 1 displays items 1 to 5 (pageSize = 5)
    expect(screen.getAllByText("YC-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("YC-005").length).toBeGreaterThan(0);
    expect(screen.queryByText("YC-006")).not.toBeInTheDocument();

    // Pagination display
    expect(screen.getByText(/Hiển thị/)).toBeInTheDocument();
    expect(screen.getByText("Trang")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // totalPages = 3

    // Click next page button "Sau"
    const nextBtn = screen.getByRole("button", { name: /Sau/i });
    fireEvent.click(nextBtn);

    // Page 2 displays items 6 to 10
    expect(screen.queryByText("YC-001")).not.toBeInTheDocument();
    expect(screen.getAllByText("YC-006").length).toBeGreaterThan(0);
    expect(screen.getAllByText("YC-010").length).toBeGreaterThan(0);
    expect(screen.queryByText("YC-011")).not.toBeInTheDocument();

    // Click next again to Page 3
    fireEvent.click(nextBtn);
    expect(screen.getAllByText("YC-011").length).toBeGreaterThan(0);
    expect(screen.getAllByText("YC-012").length).toBeGreaterThan(0);
    expect(screen.queryByText("YC-010")).not.toBeInTheDocument();

    // Click previous "Trước" to return to Page 2
    const prevBtn = screen.getByRole("button", { name: /Trước/i });
    fireEvent.click(prevBtn);
    expect(screen.getAllByText("YC-006").length).toBeGreaterThan(0);
  });

  it("renders DriverDashboardView correctly with QR scan hero button", () => {
    const driverData: DriverDashboardData = {
      driverName: "Bác Tài Ba",
      assignedVehicle: {
        id: "veh-1",
        code: "XE-01",
        name: "Xe ben Howo 15 tấn",
        licensePlate: "60C-12345",
        type: "dump_truck",
        calcUnit: "km",
        standardRate: 28.5,
      },
      lastDispense: {
        id: "disp-1",
        code: "BD-001",
        liters: 150,
        meter: 45200,
        createdAt: "2026-09-19T14:00:00Z",
        vehicleName: "Xe ben Howo 15 tấn",
      },
      monthStats: {
        totalLiters: 450,
        dispenseCount: 3,
      },
      recentDispenses: [
        {
          id: "disp-1",
          code: "BD-001",
          liters: 150,
          vehicleName: "Xe ben Howo 15 tấn",
          meter: 45200,
          createdAt: "2026-09-19T14:00:00Z",
          status: "completed",
        },
      ],
    };

    render(
      <DriverDashboardView
        profile={{ ...baseProfile, role: "driver", name: "Bác Tài Ba" }}
        data={driverData}
      />
    );

    expect(screen.getByText(/Xin chào, Bác Tài Ba/i)).toBeInTheDocument();
    expect(screen.getByText("TIẾP NHIÊN LIỆU XE CƠ GIỚI")).toBeInTheDocument();
    expect(screen.getByText("QUÉT MÃ QR BƠM DẦU NGAY")).toBeInTheDocument();
    expect(screen.getAllByText("Xe ben Howo 15 tấn").length).toBeGreaterThan(0);
    expect(screen.getByText("60C-12345")).toBeInTheDocument();
    expect(screen.getByText(/450 Lít/i)).toBeInTheDocument();
  });
});
