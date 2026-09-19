import { describe, it, expect } from "vitest";
import { renderRoleEmail } from "./render-role-email";
import { getEventPolicy } from "../server/policies";
import type { ResolvedRecipient } from "../server/resolve-recipients";

describe("Role Email Templates", () => {
  const mockRequester: ResolvedRecipient = {
    id: "usr-req",
    name: "Nguyễn Văn Yêu Cầu",
    email: "req@mtp.vn",
    role: "requester",
  };

  const mockWarehouse: ResolvedRecipient = {
    id: "usr-wh",
    name: "Lê Văn Thủ Kho",
    email: "wh@mtp.vn",
    role: "warehouse",
  };

  const mockAccountant: ResolvedRecipient = {
    id: "usr-acct",
    name: "Trần Thị Kế Toán",
    email: "acct@mtp.vn",
    role: "accountant",
  };

  const mockDriver: ResolvedRecipient = {
    id: "usr-driver",
    name: "Phạm Văn Lái Xe",
    email: "driver@mtp.vn",
    role: "driver",
  };

  it("renders Action Email with CẦN XỬ LÝ badge, items table and action CTA", () => {
    const policy = getEventPolicy("requisition.approved");
    const html = renderRoleEmail({
      policy,
      recipient: mockWarehouse,
      input: {
        event: "requisition.approved",
        subject: { type: "requisition", id: "req-1" },
        payload: {
          code: "YC-001",
          requesterName: "Nguyễn Văn Yêu Cầu",
          zoneName: "Khu Trại 1",
          purpose: "Bảo dưỡng máy bơm",
          items: [
            { name: "Phớt chặn dầu 25x40x7", quantity: 4, unit: "Cái" },
            { name: "Dầu nhớt bôi trơn", quantity: 2, unit: "Lít", note: "Giao gấp" },
          ],
        },
      },
      link: "/requisitions/req-1",
      baseUrl: "https://mtp.example.com",
    });

    expect(html).toContain("CẦN XỬ LÝ");
    expect(html).toContain("Mở phiếu để xử lý");
    expect(html).toContain("YC-001");
    expect(html).toContain("Nguyễn Văn Yêu Cầu");
    expect(html).toContain("https://mtp.example.com/requisitions/req-1");
    expect(html).toContain("Phớt chặn dầu 25x40x7");
    expect(html).toContain("4");
    expect(html).toContain("Dầu nhớt bôi trơn");
    expect(html).toContain("Giao gấp");
    // Verify brand color #ea580c is present in template
    expect(html).toContain("#ea580c");
  });

  it("renders Result Email with appropriate status and details", () => {
    const policy = getEventPolicy("requisition.rejected");
    const html = renderRoleEmail({
      policy,
      recipient: mockRequester,
      input: {
        event: "requisition.rejected",
        subject: { type: "requisition", id: "req-1" },
        payload: {
          code: "YC-001",
          reason: "Hết ngân sách tháng",
        },
      },
      link: "/requisitions/req-1",
    });

    expect(html).toContain("BỊ TỪ CHỐI");
    expect(html).toContain("Xem chi tiết");
    expect(html).toContain("Hết ngân sách tháng");
  });

  it("renders Finance Email with financial amounts and invoice details for accountant", () => {
    const policy = getEventPolicy("receipt.posted");
    const html = renderRoleEmail({
      policy,
      recipient: mockAccountant,
      input: {
        event: "receipt.posted",
        subject: { type: "receipt", id: "rec-1" },
        payload: {
          code: "PNK-001",
          supplierName: "Công ty Cổ phần Nông Nghiệp Xanh",
          totalAmount: 15500000,
          invoiceNumber: "HD-8899",
          itemCount: 5,
          items: [
            { name: "Thức ăn hỗn hợp cho gà", quantity: 50, unit: "Bao" },
          ],
        },
      },
      link: "/receipts/rec-1",
    });

    expect(html).toContain("KIỂM TRA CHỨNG TỪ TÀI CHÍNH");
    expect(html).toContain("15.500.000");
    expect(html).toContain("HD-8899");
    expect(html).toContain("Công ty Cổ phần Nông Nghiệp Xanh");
    expect(html).toContain("Thức ăn hỗn hợp cho gà");
    expect(html).toContain("50");
    expect(html).toContain("Kiểm tra chứng từ");
  });

  it("NEGATIVE SECURITY: never renders financial data (totalAmount, invoice) in driver or non-finance emails", () => {
    const policy = getEventPolicy("fuel.dispensed");
    const html = renderRoleEmail({
      policy,
      recipient: mockDriver,
      input: {
        event: "fuel.dispensed",
        subject: { type: "fuel_dispense", id: "fuel-1" },
        payload: {
          code: "CPD-001",
          fuelTypeName: "Dầu DO 0.05S",
          quantity: 120,
          unit: "Lít",
          vehicleCode: "70C-123.45",
          vehicleName: "Xe ben Howo",
          currentOdo: 15400,
          odoUnit: "km",
          zoneName: "Khu Trại 2",
          totalAmount: 2500000, // Inadvertently attached in payload
        },
      },
      link: "/fuel",
    });

    expect(html).toContain("70C-123.45");
    expect(html).toContain("120");
    expect(html).toContain("15.400");
    expect(html).toContain("Khu Trại 2");
    expect(html).not.toContain("2.500.000");
    expect(html).not.toContain("2500000");
    expect(html).not.toContain("Tổng tiền");
  });
});
