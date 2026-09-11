import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyUsers, getManagerIds } from "./notifications";
import * as emailModule from "./email";
import * as serverSupabase from "@/lib/supabase/server";

describe("lib/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getManagerIds", () => {
    it("trả về danh sách id của manager và superuser đang hoạt động", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: "user-1" }, { id: "user-2" }],
                error: null,
              }),
            }),
          }),
        }),
      };

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>,
      );

      const ids = await getManagerIds();
      expect(ids).toEqual(["user-1", "user-2"]);
    });
  });

  describe("notifyUsers", () => {
    it("tạo thông báo in-app và gửi email cho người dùng có email", async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "user-1", name: "Nguyễn Văn A", email: "a@gmail.com", is_active: true },
                { id: "user-2", name: "Trần Văn B", email: null, is_active: true },
              ],
              error: null,
            }),
          }),
        }),
        rpc: mockRpc,
      };

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>,
      );
      const sendEmailSpy = vi.spyOn(emailModule, "sendEmail").mockResolvedValue({ success: true });

      await notifyUsers({
        userIds: ["user-1", "user-2"],
        type: "requisition",
        title: "Phiếu đã duyệt",
        body: "Đã duyệt phiếu REQ-001",
        link: "/requisitions/123",
      });

      // Kiểm tra gọi RPC in-app cho 2 user
      expect(mockRpc).toHaveBeenCalledTimes(2);
      expect(mockRpc).toHaveBeenCalledWith("create_notification", {
        p_user_id: "user-1",
        p_type: "requisition",
        p_title: "Phiếu đã duyệt",
        p_body: "Đã duyệt phiếu REQ-001",
        p_link: "/requisitions/123",
      });
      expect(mockRpc).toHaveBeenCalledWith("create_notification", {
        p_user_id: "user-2",
        p_type: "requisition",
        p_title: "Phiếu đã duyệt",
        p_body: "Đã duyệt phiếu REQ-001",
        p_link: "/requisitions/123",
      });

      // Chỉ user-1 có email hợp lệ nên chỉ gửi 1 email
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "a@gmail.com",
          subject: "[MTP Supply] Phiếu đã duyệt",
        }),
      );
    });

    it("bỏ qua người nhận có email nội bộ @mtp.local", async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "user-local", name: "Tài khoản local", email: "user@mtp.local", is_active: true },
              ],
              error: null,
            }),
          }),
        }),
        rpc: mockRpc,
      };

      vi.spyOn(serverSupabase, "createClient").mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>,
      );
      const sendEmailSpy = vi.spyOn(emailModule, "sendEmail").mockResolvedValue({ success: true });

      await notifyUsers({
        userIds: ["user-local"],
        type: "requisition",
        title: "Thông báo mới",
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).not.toHaveBeenCalled();
    });
  });
});
