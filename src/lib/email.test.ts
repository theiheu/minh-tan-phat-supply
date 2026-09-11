import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isEmailConfigured, renderNotificationEmailHtml, sendEmail } from "./email";
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
    it("tạo HTML thông báo đầy đủ các trường", () => {
      const html = renderNotificationEmailHtml({
        title: "Phiếu REQ-001 đã duyệt",
        body: "Quản lý kho đã duyệt phiếu của bạn.",
        link: "/requisitions/123",
        recipientName: "Nguyễn Văn A",
      });

      expect(html).toContain("MINH TÂN PHÁT");
      expect(html).toContain("Xin chào <strong>Nguyễn Văn A</strong>,");
      expect(html).toContain("Phiếu REQ-001 đã duyệt");
      expect(html).toContain("Quản lý kho đã duyệt phiếu của bạn.");
      expect(html).toContain("/requisitions/123");
      expect(html).toContain("Xem chi tiết trên hệ thống");
    });

    it("tạo HTML khi không có link và recipientName", () => {
      const html = renderNotificationEmailHtml({
        title: "Cảnh báo tồn kho",
        body: "Vật tư sắp hết hàng.",
      });

      expect(html).toContain("Xin chào,");
      expect(html).toContain("Cảnh báo tồn kho");
      expect(html).toContain("Vật tư sắp hết hàng.");
      expect(html).not.toContain("Xem chi tiết trên hệ thống");
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

    it("gửi email thành công khi đã cấu hình SMTP", async () => {
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
        subject: "Thông báo duyệt phiếu",
        html: "<p>Nội dung</p>",
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("<msg-123@mtp.vn>");
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "staff@example.com",
          subject: "Thông báo duyệt phiếu",
        }),
      );
    });
  });
});
