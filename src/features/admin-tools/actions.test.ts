import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  adminDeleteDocAction,
  adminInspectDocAction,
  adminOverrideMetaAction,
  adminReopenDocAction,
} from "./actions";

const VALID_UUID_1 = "47814b7e-9762-42da-91ef-07755efcfa77";
const VALID_UUID_2 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const VALID_UUID_3 = "c8f2b3e4-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

// Mock auth
const mockRequireProfile = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireProfile: () => mockRequireProfile(),
}));

// Mock supabase client
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
  })),
}));

describe("admin-tools actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("permission checks", () => {
    it("rejects non-admin roles (e.g. requester)", async () => {
      mockRequireProfile.mockResolvedValue({ id: "user-1", role: "requester" });

      await expect(
        adminDeleteDocAction({
          kind: "receipt",
          id: VALID_UUID_1,
          cascade: false,
          reason: "Test delete",
        })
      ).rejects.toThrow("Bạn không có quyền thực hiện thao tác can thiệp quản trị viên");
    });

    it("rejects technician role", async () => {
      mockRequireProfile.mockResolvedValue({ id: "user-2", role: "technician" });

      await expect(
        adminReopenDocAction({
          kind: "repair",
          id: VALID_UUID_2,
          reason: "Test reopen",
        })
      ).rejects.toThrow("Bạn không có quyền thực hiện thao tác can thiệp quản trị viên");
    });
  });

  describe("adminDeleteDocAction", () => {
    it("calls admin_delete_document RPC with proper params for superuser", async () => {
      mockRequireProfile.mockResolvedValue({ id: "admin-1", role: "superuser" });
      mockRpc.mockResolvedValue({ error: null });

      const res = await adminDeleteDocAction({
        kind: "issue",
        id: VALID_UUID_1,
        cascade: true,
        reason: "Huỷ phiếu xuất sai",
      });

      expect(res.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("admin_delete_document", {
        p_kind: "issue",
        p_id: VALID_UUID_1,
        p_cascade: true,
        p_reason: "Huỷ phiếu xuất sai",
        p_by: "admin-1",
      });
    });

    it("calls admin_delete_document RPC for owner role", async () => {
      mockRequireProfile.mockResolvedValue({ id: "owner-1", role: "owner" });
      mockRpc.mockResolvedValue({ error: null });

      const res = await adminDeleteDocAction({
        kind: "requisition",
        id: VALID_UUID_2,
        cascade: false,
        reason: "Xoá phiếu yêu cầu",
      });

      expect(res.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("admin_delete_document", {
        p_kind: "requisition",
        p_id: VALID_UUID_2,
        p_cascade: false,
        p_reason: "Xoá phiếu yêu cầu",
        p_by: "owner-1",
      });
    });
  });

  describe("adminReopenDocAction", () => {
    it("calls admin_reopen_document RPC correctly", async () => {
      mockRequireProfile.mockResolvedValue({ id: "admin-1", role: "superuser" });
      mockRpc.mockResolvedValue({ error: null });

      const res = await adminReopenDocAction({
        kind: "receipt",
        id: VALID_UUID_3,
        reason: "Mở lại phiếu nhập để bổ sung hàng",
      });

      expect(res.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("admin_reopen_document", {
        p_kind: "receipt",
        p_id: VALID_UUID_3,
        p_reason: "Mở lại phiếu nhập để bổ sung hàng",
        p_by: "admin-1",
      });
    });
  });

  describe("adminInspectDocAction", () => {
    it("calls admin_inspect_document_dependencies RPC and returns data", async () => {
      mockRequireProfile.mockResolvedValue({ id: "admin-1", role: "superuser" });
      mockRpc.mockResolvedValue({
        data: {
          document: { id: VALID_UUID_1, code: "PYC-01" },
          dependencies: [],
          movements_count: 2,
          can_direct_delete: true,
        },
        error: null,
      });

      const res = await adminInspectDocAction("requisition", VALID_UUID_1);
      expect(res.document.code).toBe("PYC-01");
      expect(res.can_direct_delete).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("admin_inspect_document_dependencies", {
        p_kind: "requisition",
        p_id: VALID_UUID_1,
      });
    });
  });

  describe("adminOverrideMetaAction", () => {
    it("calls admin_override_document_meta RPC with override fields", async () => {
      mockRequireProfile.mockResolvedValue({ id: "admin-1", role: "superuser" });
      mockRpc.mockResolvedValue({ error: null });

      const res = await adminOverrideMetaAction({
        kind: "issue",
        id: VALID_UUID_1,
        notes: "Ghi chú mới",
        reason: "Cập nhật lại lý do xuất",
      });

      expect(res.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("admin_override_document_meta", {
        p_kind: "issue",
        p_id: VALID_UUID_1,
        p_created_at: null,
        p_actor_id: null,
        p_notes: "Ghi chú mới",
        p_reason: "Cập nhật lại lý do xuất",
        p_by: "admin-1",
      });
    });
  });
});
