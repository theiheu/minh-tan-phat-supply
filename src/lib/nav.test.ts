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
    const managerItems = filterByRole(ALL_NAV_ITEMS, "manager");
    const requesterItems = filterByRole(ALL_NAV_ITEMS, "requester");
    const superuserItems = filterByRole(ALL_NAV_ITEMS, "superuser");

    expect(managerItems.length).toBeGreaterThan(requesterItems.length);
    expect(superuserItems.length).toBe(ALL_NAV_ITEMS.length);

    // Requesters should not see receipts or admin
    expect(requesterItems.some((i) => i.href === "/receipts")).toBe(false);
    expect(requesterItems.some((i) => i.href.startsWith("/admin"))).toBe(false);

    // Managers should see receipts and admin
    expect(managerItems.some((i) => i.href === "/receipts")).toBe(true);
    expect(managerItems.some((i) => i.href === "/admin/products")).toBe(true);
  });

  it("filters groups by role properly", () => {
    const managerGroups = filterGroupsByRole(NAV_GROUPS, "manager");
    const requesterGroups = filterGroupsByRole(NAV_GROUPS, "requester");

    const managerGroupIds = managerGroups.map((g) => g.id);
    const requesterGroupIds = requesterGroups.map((g) => g.id);

    expect(managerGroupIds).toContain("warehouse");
    expect(managerGroupIds).toContain("fuel");
    expect(managerGroupIds).toContain("admin");

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

  it("includes /tools navigation item for all authenticated roles", () => {
    const requesterItems = filterByRole(ALL_NAV_ITEMS, "requester");
    const managerItems = filterByRole(ALL_NAV_ITEMS, "manager");
    expect(requesterItems.some((i) => i.href === "/tools")).toBe(true);
    expect(managerItems.some((i) => i.href === "/tools")).toBe(true);
  });
});
