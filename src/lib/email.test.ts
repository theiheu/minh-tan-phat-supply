import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isEmailConfigured, renderNotificationEmailHtml, sendEmail, DEFAULT_ERP_FROM } from "./email";
import nodemailer from "nodemailer";

describe("lib/email", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isEmailConfigured", () => {
    it("trả về false khi không có SMTP_HOST", () => {
      delete process.env.SMTP_HOST;
      expect(isEmailConfigured()).toBe(false);
    });

    it("trả về true khi có SMTP_HOST hợp lệ", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe("renderNotificationEmailHtml", () => {
    it("tạo HTML thông báo chuẩn MTP-ERP đầy đủ các trường", () => {
      const html = renderNotificationEmailHtml({
        title: "Phiếu REQ-001 đã duyệt",
        body: "Quản lý kho đã duyệt phiếu của bạn.",
        link: "/requisitions/123",
        recipientName: "Nguyễn Văn A",
        document: {
          code: "REQ-001",
          type: "Phiếu yêu cầu cấp phát",
          status: "Đã phê duyệt",
          statusVariant: "success",
          handlerName: "Trần Quản Lý",
          locationName: "Trại Gà Trảng Bom",
        },
      });

      expect(html).toContain("CÔNG TY TNHH MINH TÂN PHÁT");
      expect(html).toContain("MTP-ERP");
      expect(html).toContain("Kính gửi Ông/Bà <strong>Nguyễn Văn A</strong>,");
      expect(html).toContain("Phiếu REQ-001 đã duyệt");
      expect(html).toContain("Quản lý kho đã duyệt phiếu của bạn.");
      expect(html).toContain("REQ-001");
      expect(html).toContain("Trần Quản Lý");
      expect(html).toContain("Trại Gà Trảng Bom");
      expect(html).toContain("/requisitions/123");
      expect(html).toContain("XEM CHI TIẾT TRÊN HỆ THỐNG MTP-ERP");
    });

    it("tạo HTML khi không có link và recipientName", () => {
      const html = renderNotificationEmailHtml({
        title: "Cảnh báo tồn kho",
        body: "Vật tư sắp hết hàng.",
      });

      expect(html).toContain("Kính gửi Quý nhân sự,");
      expect(html).toContain("Cảnh báo tồn kho");
      expect(html).toContain("Vật tư sắp hết hàng.");
      expect(html).not.toContain("XEM CHI TIẾT TRÊN HỆ THỐNG MTP-ERP");
    });

    it("render bảng chi tiết danh sách vật tư chuẩn MTP-ERP khi có items", () => {
      const html = renderNotificationEmailHtml({
        title: "[Yêu cầu cấp phát] YCCP-2024-001 - Chờ duyệt",
        body: "Đề xuất cấp vật tư chuồng 1",
        document: {
          code: "YCCP-2024-001",
          type: "Phiếu yêu cầu cấp phát",
          items: [
            { name: "Bóng đèn sưởi hồng ngoại", quantity: 10, unit: "Cái", note: "Ưu tiên" },
            { name: "Máng ăn tự động", quantity: 5, unit: "Bộ" },
          ],
        },
      });

      expect(html).toContain("Bóng đèn sưởi hồng ngoại");
      expect(html).toContain("10");
      expect(html).toContain("Máng ăn tự động");
      expect(html).toContain("5");
    });
  });

  describe("sendEmail", () => {
    it("trả về lỗi SMTP_NOT_CONFIGURED khi chưa cấu hình SMTP", async () => {
      delete process.env.SMTP_HOST;
      const res = await sendEmail({
        to: "staff@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });

      expect(res.success).toBe(false);
      expect(res.reason).toBe("SMTP_NOT_CONFIGURED");
    });

    it("gửi email thành công với người gửi chuẩn MTP-ERP", async () => {
      process.env.SMTP_HOST = "smtp.mailtrap.io";
      process.env.SMTP_PORT = "2525";
      process.env.SMTP_USER = "user123";
      process.env.SMTP_PASS = "pass123";

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "<msg-123@mtp.vn>" });
      vi.spyOn(nodemailer, "createTransport").mockReturnValue({
        sendMail: mockSendMail,
      } as unknown as ReturnType<typeof nodemailer.createTransport>);

      const res = await sendEmail({
        to: "staff@example.com",
        subject: "[MTP-ERP] Thông báo duyệt phiếu",
        html: "<p>Nội dung</p>",
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("<msg-123@mtp.vn>");
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: DEFAULT_ERP_FROM,
          to: "staff@example.com",
          subject: "[MTP-ERP] Thông báo duyệt phiếu",
        }),
      );
    });
  });
});
