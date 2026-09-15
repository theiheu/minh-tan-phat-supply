import { describe, expect, it } from "vitest";
import {
  ALL_NAV_ITEMS,
  NAV_GROUPS,
  filterByRole,
  filterGroupsByRole,
  findTitle,
  isGroupActive,
} from "./nav";

describe("nav", () => {
  it("filters items by role correctly", () => {
    const warehouseItems = filterByRole(ALL_NAV_ITEMS, "warehouse");
    const requesterItems = filterByRole(ALL_NAV_ITEMS, "requester");
    const superuserItems = filterByRole(ALL_NAV_ITEMS, "superuser");

    expect(warehouseItems.length).toBeGreaterThan(requesterItems.length);
    expect(superuserItems.length).toBe(ALL_NAV_ITEMS.length);

    // Requesters should not see receipts or admin
    expect(requesterItems.some((i) => i.href === "/receipts")).toBe(false);
    expect(requesterItems.some((i) => i.href.startsWith("/admin"))).toBe(false);

    // Warehouse managers should see receipts and admin
    expect(warehouseItems.some((i) => i.href === "/receipts")).toBe(true);
    expect(warehouseItems.some((i) => i.href === "/admin/products")).toBe(true);
  });

  it("filters groups by role properly", () => {
    const warehouseGroups = filterGroupsByRole(NAV_GROUPS, "warehouse");
    const requesterGroups = filterGroupsByRole(NAV_GROUPS, "requester");

    const warehouseGroupIds = warehouseGroups.map((g) => g.id);
    const requesterGroupIds = requesterGroups.map((g) => g.id);

    expect(warehouseGroupIds).toContain("warehouse");
    expect(warehouseGroupIds).toContain("fuel");
    expect(warehouseGroupIds).toContain("admin");

    expect(requesterGroupIds).not.toContain("warehouse");
    expect(requesterGroupIds).not.toContain("fuel");
    expect(requesterGroupIds).not.toContain("admin");
    expect(requesterGroupIds).toContain("dashboard");
    expect(requesterGroupIds).toContain("requisitions");
    expect(requesterGroupIds).toContain("defects");
  });

  it("detects active group accurately", () => {
    const reqGroup = NAV_GROUPS.find((g) => g.id === "requisitions")!;
    const whGroup = NAV_GROUPS.find((g) => g.id === "warehouse")!;
    const defectGroup = NAV_GROUPS.find((g) => g.id === "defects")!;
    const adminGroup = NAV_GROUPS.find((g) => g.id === "admin")!;

    expect(isGroupActive(reqGroup, "/products")).toBe(true);
    expect(isGroupActive(reqGroup, "/requisitions")).toBe(true);
    expect(isGroupActive(reqGroup, "/requisitions/new")).toBe(true);
    expect(isGroupActive(reqGroup, "/tools")).toBe(true);
    expect(isGroupActive(reqGroup, "/receipts")).toBe(false);

    expect(isGroupActive(whGroup, "/receipts")).toBe(true);
    expect(isGroupActive(whGroup, "/issues/123")).toBe(true);
    expect(isGroupActive(whGroup, "/transfers")).toBe(true);
    expect(isGroupActive(whGroup, "/stocktake")).toBe(true);

    expect(isGroupActive(defectGroup, "/defects")).toBe(true);
    expect(isGroupActive(defectGroup, "/repairs")).toBe(true);
    expect(isGroupActive(defectGroup, "/liquidations")).toBe(true);

    expect(isGroupActive(adminGroup, "/admin/products")).toBe(true);
    expect(isGroupActive(adminGroup, "/admin/categories")).toBe(true);
    expect(isGroupActive(adminGroup, "/admin/zones")).toBe(true);
  });

  it("finds matching title for paths", () => {
    expect(findTitle("/dashboard")).toBe("Trang chủ");
    expect(findTitle("/products")).toBe("Chọn vật tư");
    expect(findTitle("/requisitions")).toBe("Phiếu yêu cầu");
    expect(findTitle("/tools")).toBe("Dụng cụ");
    expect(findTitle("/receipts")).toBe("Phiếu nhập");
    expect(findTitle("/issues")).toBe("Phiếu xuất");
    expect(findTitle("/transfers")).toBe("Chuyển kho");
    expect(findTitle("/stocktake")).toBe("Kiểm kê");
    expect(findTitle("/defects")).toBe("Vật tư hỏng & Đổi mới");
    expect(findTitle("/repairs")).toBe("Sửa chữa");
    expect(findTitle("/liquidations")).toBe("Thanh lý");
    expect(findTitle("/fuel")).toBe("Kho dầu");
    expect(findTitle("/admin/products")).toBe("Vật tư");
  });

  it("includes /tools navigation item for all supply roles", () => {
    const requesterItems = filterByRole(ALL_NAV_ITEMS, "requester");
    const warehouseItems = filterByRole(ALL_NAV_ITEMS, "warehouse");
    const technicianItems = filterByRole(ALL_NAV_ITEMS, "technician");
    expect(requesterItems.some((i) => i.href === "/tools")).toBe(true);
    expect(warehouseItems.some((i) => i.href === "/tools")).toBe(true);
    expect(technicianItems.some((i) => i.href === "/tools")).toBe(true);
  });

  it("filters navigation for technician (Quản lý khu) and driver (Tài xế)", () => {
    const technicianGroups = filterGroupsByRole(NAV_GROUPS, "technician");
    const driverGroups = filterGroupsByRole(NAV_GROUPS, "driver");

    const techGroupIds = technicianGroups.map((g) => g.id);
    const driverGroupIds = driverGroups.map((g) => g.id);

    // Technician sees dashboard, requisitions, defects, reports
    expect(techGroupIds).toContain("dashboard");
    expect(techGroupIds).toContain("requisitions");
    expect(techGroupIds).toContain("defects");
    expect(techGroupIds).toContain("reports");
    expect(techGroupIds).not.toContain("warehouse");
    expect(techGroupIds).not.toContain("admin");

    // Driver sees dashboard, fuel
    expect(driverGroupIds).toContain("dashboard");
    expect(driverGroupIds).toContain("fuel");
    expect(driverGroupIds).not.toContain("warehouse");
    expect(driverGroupIds).not.toContain("admin");
    expect(driverGroupIds).not.toContain("requisitions");
  });
});
