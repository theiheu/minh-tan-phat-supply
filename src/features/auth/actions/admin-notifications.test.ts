import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendTestEmailAction,
  broadcastNotificationAction,
  batchAssignEmailsAction,
} from "./admin-notifications";
import * as authLib from "@/lib/auth";
import * as emailLib from "@/lib/email";
import * as notificationsLib from "@/lib/notifications";
import * as serverSupabase from "@/lib/supabase/server";
import * as adminSupabase from "@/lib/supabase/admin";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("features/auth/actions/admin-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendTestEmailAction", () => {
    it("gửi email test thành công khi SMTP đã cấu hình", async () => {
      vi.spyOn(authLib, "requireManager").mockResolvedValue({
        id: "manager-1",
        role: "manager",
      } as unknown as Awaited<ReturnType<typeof authLib.requireManager>>);
      vi.spyOn(emailLib, "isEmailConfigured").mockReturnValue(true);
      const sendSpy = vi
        .spyOn(emailLib, "sendEmail")
        .mockResolvedValue({ success: true, messageId: "<test-id@mtp.vn>" });

      const res = await sendTestEmailAction("test@minhtanphat.vn");
      expect(res.success).toBe(true);
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@minhtanphat.vn",
          subject: expect.stringContaining("Email Doanh Nghiệp"),
        }),
      );
    });

    it("báo lỗi nếu chưa cấu hình SMTP", async () => {
      vi.spyOn(authLib, "requireManager").mockResolvedValue({
        id: "manager-1",
        role: "manager",
      } as unknown as Awaited<ReturnType<typeof authLib.requireManager>>);
      vi.spyOn(emailLib, "isEmailConfigured").mockReturnValue(false);

      await expect(sendTestEmailAction("test@minhtanphat.vn")).rejects.toThrow(
        "Chưa cấu hình biến môi trường SMTP_HOST",
      );
    });
  });

  describe("broadcastNotificationAction", () => {
    it("gửi thông báo tới toàn bộ người dùng", async () => {
      vi.spyOn(authLib, "requireManager").mockResolvedValue({
        id: "manager-1",
        role: "manager",
      } as unknown as Awaited<ReturnType<typeof authLib.requireManager>>);

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: "u-1" }, { id: "u-2" }],
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
      vi.spyOn(serverSupabase, "createClient").mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>,
      );

      const notifySpy = vi.spyOn(notificationsLib, "notifyUsers").mockResolvedValue();

      const res = await broadcastNotificationAction({
        title: "Bảo trì hệ thống",
        body: "Hệ thống sẽ bảo trì lúc 22h",
      });

      expect(res.count).toBe(2);
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: ["u-1", "u-2"],
          title: "Bảo trì hệ thống",
        }),
      );
    });
  });

  describe("batchAssignEmailsAction", () => {
    it("gán email theo cú pháp username@domain", async () => {
      vi.spyOn(authLib, "requireManager").mockResolvedValue({
        id: "manager-1",
        role: "manager",
      } as unknown as Awaited<ReturnType<typeof authLib.requireManager>>);

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [
                  { id: "u-1", username: "vana", email: null },
                  { id: "u-2", username: "vanb", email: null },
                ],
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        }),
      };

      vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue(
        mockAdmin as unknown as ReturnType<typeof adminSupabase.createAdminClient>,
      );

      const res = await batchAssignEmailsAction({ domain: "minhtanphat.vn" });
      expect(res.updatedCount).toBe(2);
      expect(mockUpdate).toHaveBeenCalledWith({ email: "vana@minhtanphat.vn" });
      expect(mockUpdate).toHaveBeenCalledWith({ email: "vanb@minhtanphat.vn" });
    });
  });
});
