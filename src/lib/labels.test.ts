import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  auditActionTone,
  auditEntityHref,
  auditEntityLabel,
  roleLabel,
  statusBadgeVariant,
  variantLabel,
} from "./labels";

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
    expect(statusBadgeVariant("posted")).toBe("success");
    expect(variantLabel({ "Quy cách": "Hộp 10 vỉ" })).toBe("Hộp 10 vỉ");
  });
});
