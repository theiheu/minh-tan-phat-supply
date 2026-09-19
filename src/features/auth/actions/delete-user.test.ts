import { describe, it, expect, vi, beforeEach } from "vitest";
import { archiveUser, checkUserDeleteEligibility, deleteUser, reactivateUser } from "./delete-user";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockRequireSuperuser = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireSuperuser: () => mockRequireSuperuser(),
}));

const mockDeleteUser = vi.fn();
const mockAdminFrom = vi.fn();
const mockAdminRpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
      },
    },
    from: mockAdminFrom,
    rpc: mockAdminRpc,
  }),
}));

describe("delete-user and lifecycle Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chặn người dùng không có quyền xóa (như quản kho, kỹ thuật, người yêu cầu, tài xế, kế toán, chủ trại)", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "user-wh", role: "warehouse" });
    await expect(deleteUser({ userId: "target-1" })).rejects.toThrow(
      "Chỉ quản trị hệ thống mới có quyền xóa tài khoản",
    );
  });

  it("chặn tự xóa hoặc tự lưu trữ tài khoản của chính mình", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "user-super", role: "superuser" });
    await expect(deleteUser({ userId: "user-super" })).rejects.toThrow(
      "Không thể tự xóa tài khoản của chính mình",
    );
    await expect(archiveUser({ userId: "user-super" })).rejects.toThrow(
      "Không thể tự lưu trữ tài khoản của chính mình",
    );
  });

  it("chặn xóa tài khoản hệ thống (is_protected = true)", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "user-super", role: "superuser" });
    mockAdminFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: "sys-1", name: "Admin", is_protected: true } }),
        }),
      }),
    });

    await expect(deleteUser({ userId: "sys-1" })).rejects.toThrow(
      "Không thể xóa tài khoản hệ thống",
    );
  });

  it("checkUserDeleteEligibility phân biệt chính xác tài khoản đã có lịch sử vs chưa có lịch sử", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "user-super", role: "superuser" });

    // Mock có 5 biến động kho
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "stock_movements") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: 5 }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ count: 0 }),
          or: () => Promise.resolve({ count: 0 }),
        }),
      };
    });

    const res = await checkUserDeleteEligibility({ userId: "user-has-history" });
    expect(res.canHardDelete).toBe(false);
    expect(res.historyReason).toContain("5 biến động kho");
  });

  it("cho phép Quản trị hệ thống (superuser) xóa sạch tài khoản cùng toàn bộ lịch sử (force = true)", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "user-super", role: "superuser" });
    mockAdminRpc.mockResolvedValue({ error: null });
    mockDeleteUser.mockResolvedValue({ error: null });

    const mockInsert = vi.fn().mockReturnValue(Promise.resolve({ error: null }));
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "user-with-slips", name: "User Có Phiếu", is_protected: false } }),
            }),
          }),
        };
      }
      if (table === "audit_logs") {
        return { insert: mockInsert };
      }
      return {};
    });

    await deleteUser({ userId: "user-with-slips", force: true });
    expect(mockAdminRpc).toHaveBeenCalledWith("admin_purge_user_data", { p_user_id: "user-with-slips" });
    expect(mockDeleteUser).toHaveBeenCalledWith("user-with-slips");
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "profile.force_delete" }));
  });

  it("archiveUser cập nhật is_active = false và ghi audit log", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "user-super", role: "superuser" });
    const mockUpdate = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    const mockInsert = vi.fn().mockReturnValue(Promise.resolve({ error: null }));

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "user-to-archive", name: "User A", username: "usera", is_protected: false, is_active: true } }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === "audit_logs") {
        return { insert: mockInsert };
      }
      return {};
    });

    await archiveUser({ userId: "user-to-archive" });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "profile.archive" }));
  });

  it("reactivateUser cập nhật is_active = true và ghi audit log", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "user-super", role: "superuser" });
    const mockUpdate = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    const mockInsert = vi.fn().mockReturnValue(Promise.resolve({ error: null }));

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "user-to-reactivate", name: "User B", username: "userb", is_active: false } }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === "audit_logs") {
        return { insert: mockInsert };
      }
      return {};
    });

    await reactivateUser({ userId: "user-to-reactivate" });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_active: true }));
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "profile.reactivate" }));
  });
});
