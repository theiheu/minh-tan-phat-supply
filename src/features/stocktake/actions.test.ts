import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStocktake,
  postStocktake,
  toggleStocktakeItemChecked,
  toggleAllStocktakeItems,
  reopenStocktake,
  deleteStocktake,
} from "./actions";

const mockRpc = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRequireProfile = vi.fn();
const mockFrom = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

vi.mock("@/lib/auth", () => ({
  requireProfile: () => mockRequireProfile(),
}));

vi.mock("@/features/notifications/server/dispatch-business-event", () => ({
  dispatchBusinessEvent: vi.fn().mockResolvedValue({ inAppDeliveredCount: 1, emailAttemptedCount: 1, errors: [] }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      rpc: (...args: unknown[]) => mockRpc(...args),
      from: (...args: unknown[]) => mockFrom(...args),
    }),
  ),
}));

describe("Stocktake Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireProfile.mockResolvedValue({
      id: "user-123",
      name: "Thủ kho",
      role: "warehouse",
    });
    mockRpc.mockResolvedValue({ data: "mock-session-id", error: null });
  });

  describe("createStocktake", () => {
    it("creates stocktake session via RPC and revalidates /stocktake", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { code: "PKK-0001", name: "Kiểm kê Q3", location: { name: "Kho chính" } },
            }),
          }),
        }),
      });

      const res = await createStocktake("loc-uuid-1", "Kiểm kê Q3");
      expect(mockRequireProfile).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith("create_stocktake", {
        p_location_id: "loc-uuid-1",
        p_name: "Kiểm kê Q3",
        p_by: "user-123",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/stocktake");
      expect(res).toBe("mock-session-id");
    });

    it("throws error when stocktake name is empty", async () => {
      await expect(createStocktake("loc-uuid-1", "   ")).rejects.toThrow("Phải nhập tên phiếu kiểm kê");
    });
  });

  describe("postStocktake", () => {
    it("updates actual quantity with checked=true and calls post_stocktake RPC", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockReturnValue({
        update: mockUpdate,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { code: "PKK-0001", name: "Kiểm kê Q3" },
            }),
          }),
        }),
      });

      await postStocktake("sess-uuid-1", [
        { itemId: "item-1", actualQty: 10, notes: "Khớp" },
      ]);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          actual_qty: 10,
          notes: "Khớp",
          checked: true,
        }),
      );
      expect(mockRpc).toHaveBeenCalledWith("post_stocktake", {
        p_session_id: "sess-uuid-1",
        p_by: "user-123",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/stocktake");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/products");
    });
  });

  describe("deleteStocktake", () => {
    it("calls delete_stocktake RPC and revalidates paths", async () => {
      await deleteStocktake("sess-uuid-1");
      expect(mockRpc).toHaveBeenCalledWith("delete_stocktake", {
        p_session_id: "sess-uuid-1",
        p_by: "user-123",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/stocktake");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/products");
    });
  });

  describe("toggleStocktakeItemChecked", () => {
    it("updates checked status when session is draft", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === "stocktake_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { session_id: "sess-uuid-1" },
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === "stocktake_sessions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { status: "draft" },
                }),
              }),
            }),
          };
        }
        return {};
      });

      await toggleStocktakeItemChecked("item-1", true);
      expect(mockUpdate).toHaveBeenCalledWith({ checked: true });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/stocktake");
    });
  });

  describe("toggleAllStocktakeItems", () => {
    it("updates all items checked status when session is draft", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === "stocktake_sessions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { status: "draft" },
                }),
              }),
            }),
          };
        }
        if (table === "stocktake_items") {
          return {
            update: mockUpdate,
          };
        }
        return {};
      });

      await toggleAllStocktakeItems("sess-uuid-1", true);
      expect(mockUpdate).toHaveBeenCalledWith({ checked: true });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/stocktake");
    });
  });

  describe("reopenStocktake", () => {
    it("calls revert_stocktake RPC and revalidates paths", async () => {
      await reopenStocktake("sess-uuid-1");
      expect(mockRpc).toHaveBeenCalledWith("revert_stocktake", {
        p_session_id: "sess-uuid-1",
        p_by: "user-123",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/stocktake");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/products");
    });
  });
});
