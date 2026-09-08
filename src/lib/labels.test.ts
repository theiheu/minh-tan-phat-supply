import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  auditActionTone,
  auditEntityHref,
  auditEntityLabel,
  categoryIcon,
  roleLabel,
  slipStatusLabel,
  statusBadgeVariant,
  variantLabel,
} from "./labels";
import {
  Box,
  CircleDot,
  Droplets,
  Flame,
  FlaskConical,
  HardHat,
  Link,
  Nut,
  Package,
  Tractor,
  Wheat,
  Zap,
} from "lucide-react";

describe("labels helpers", () => {
  it("translates audit actions correctly", () => {
    expect(auditActionLabel("requisition.create")).toBe("Tạo phiếu yêu cầu");
    expect(auditActionLabel("receipt.post")).toBe("Nhập kho");
    expect(auditActionLabel("issue.post")).toBe("Xuất kho");
    expect(auditActionLabel("defect.create")).toBe("Báo hỏng vật tư");
    expect(auditActionLabel("unknown_action")).toBe("unknown_action");
    expect(auditActionLabel(null)).toBe("—");
  });

  it("returns proper badge tones for audit actions", () => {
    expect(auditActionTone("requisition.create")).toBe("info");
    expect(auditActionTone("receipt.post")).toBe("success");
    expect(auditActionTone("requisition.reject")).toBe("danger");
    expect(auditActionTone("defect.create")).toBe("warning");
    expect(auditActionTone("unknown")).toBe("neutral");
  });

  it("translates audit entity types properly", () => {
    expect(auditEntityLabel("requisition")).toBe("Phiếu yêu cầu");
    expect(auditEntityLabel("receipt")).toBe("Phiếu đặt hàng / nhập kho");
    expect(auditEntityLabel("defect_note")).toBe("Phiếu báo hỏng");
    expect(auditEntityLabel("repair_order")).toBe("Phiếu sửa chữa");
    expect(auditEntityLabel("stocktake_session")).toBe("Đợt kiểm kê");
    expect(auditEntityLabel(null)).toBe("—");
  });

  it("builds correct entity href links", () => {
    expect(auditEntityHref("requisition", "123")).toBe("/requisitions/123");
    expect(auditEntityHref("receipt", "456")).toBe("/receipts/456");
    expect(auditEntityHref("issue", "789")).toBe("/issues/789");
    expect(auditEntityHref("defect_note", "abc")).toBe("/defects/abc");
    expect(auditEntityHref("repair_order", "def")).toBe("/repairs/def");
    expect(auditEntityHref("exchange_note", "ghi")).toBe("/exchanges/ghi");
    expect(auditEntityHref("liquidation_note", "jkl")).toBe("/liquidations/jkl");
    expect(auditEntityHref("stocktake_session", "mno")).toBe("/stocktake/mno");
    expect(auditEntityHref("profile", "pqr")).toBe("/admin");
    expect(auditEntityHref("unknown", null)).toBeNull();
  });

  it("formats role and status labels", () => {
    expect(roleLabel("manager")).toBe("Quản lý kho");
    expect(roleLabel("requester")).toBe("Người yêu cầu");
    expect(roleLabel("superuser")).toBe("Quản trị hệ thống");
    expect(statusBadgeVariant("approved")).toBe("info");
    expect(statusBadgeVariant("issued")).toBe("orange");
    expect(statusBadgeVariant("posted")).toBe("success");
    expect(variantLabel({ "Quy cách": "Hộp 10 vỉ" })).toBe("Hộp 10 vỉ");
  });

  it("translates slip statuses to Vietnamese properly", () => {
    expect(slipStatusLabel("receipt", "draft")).toBe("Chờ duyệt đặt hàng");
    expect(slipStatusLabel("receipt", "approved")).toBe("Đã duyệt (Chờ hàng về)");
    expect(slipStatusLabel("receipt", "posted")).toBe("Đã nhập kho");
    expect(slipStatusLabel("requisition", "pending")).toBe("Đang chờ");
    expect(slipStatusLabel("requisition", "issued")).toBe("Đã cấp phát");
    expect(slipStatusLabel("issue", "posted")).toBe("Đã xuất");
    expect(slipStatusLabel("defect", "staging")).toBe("Kho đồ hỏng");
    expect(slipStatusLabel(null, null)).toBe("—");
  });

  it("maps 12 standard category icons properly", () => {
    expect(categoryIcon("electric")).toBe(Zap);
    expect(categoryIcon("machinery")).toBe(Tractor);
    expect(categoryIcon("tools_ppe")).toBe(HardHat);
    expect(categoryIcon("livestock")).toBe(Wheat);
    expect(categoryIcon("plumbing_pneumatics")).toBe(Droplets);
    expect(categoryIcon("bearings")).toBe(CircleDot);
    expect(categoryIcon("belts_chains")).toBe(Link);
    expect(categoryIcon("oil_chemicals")).toBe(FlaskConical);
    expect(categoryIcon("welding_cutting")).toBe(Flame);
    expect(categoryIcon("hardware_fasteners")).toBe(Nut);
    expect(categoryIcon("packaging_ropes")).toBe(Box);
    expect(categoryIcon("other")).toBe(Package);
    expect(categoryIcon(null)).toBe(Package);
    expect(categoryIcon("non_existent")).toBe(Package);
  });
});
