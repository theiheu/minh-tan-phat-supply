import { describe, it, expect, vi, beforeEach } from "vitest";
import { toolBorrowingSchema, toolReturnSchema } from "./schema";
import { createToolBorrowing, returnToolBorrowing, cancelToolBorrowing } from "./actions";

// Mock dependencies
const mockRpc = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRequireProfile = vi.fn();
const mockRequireManager = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

vi.mock("@/lib/auth", () => ({
  requireProfile: () => mockRequireProfile(),
  requireManager: () => mockRequireManager(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      rpc: (...args: unknown[]) => mockRpc(...args),
    }),
  ),
}));

describe("Tool Schemas", () => {
  it("validates borrowing input correctly", () => {
    const valid = toolBorrowingSchema.safeParse({
      items: [{ variantId: "47814b7e-9762-42da-91ef-07755efcfa77", quantity: 2 }],
      purpose: "Hàn máng ăn",
      expectedReturnDate: "2026-09-10",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects borrowing with empty purpose or zero quantity", () => {
    const invalid = toolBorrowingSchema.safeParse({
      items: [{ variantId: "47814b7e-9762-42da-91ef-07755efcfa77", quantity: 0 }],
      purpose: "",
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects borrowing with empty items array", () => {
    const invalid = toolBorrowingSchema.safeParse({
      items: [],
      purpose: "Sửa chuồng",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates tool return input correctly", () => {
    const valid = toolReturnSchema.safeParse({
      borrowingId: "47814b7e-9762-42da-91ef-07755efcfa77",
      items: [{ variantId: "55814b7e-9762-42da-91ef-07755efcfa88", quantity: 1 }],
      notes: "Trả máy hàn nguyên vẹn",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects return with empty items or invalid borrowingId", () => {
    const invalid = toolReturnSchema.safeParse({
      borrowingId: "not-a-uuid",
      items: [],
    });
    expect(invalid.success).toBe(false);
  });
});

describe("Tool Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireProfile.mockResolvedValue({
      id: "user-123",
      role: "requester",
      zone_id: "zone-1",
    });
    mockRequireManager.mockResolvedValue({
      id: "manager-456",
      role: "manager",
    });
    mockRpc.mockResolvedValue({ data: "mock-borrowing-id", error: null });
  });

  describe("createToolBorrowing", () => {
    it("creates a tool borrowing record via RPC and revalidates paths", async () => {
      const input = {
        items: [{ variantId: "47814b7e-9762-42da-91ef-07755efcfa77", quantity: 2 }],
        zoneId: "55814b7e-9762-42da-91ef-07755efcfa88",
        purpose: "Hàn máng ăn chuồng 2",
        expectedReturnDate: "2026-09-12",
      };

      const result = await createToolBorrowing(input);

      expect(mockRequireProfile).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith("create_tool_borrowing", {
        p_items: [{ variant_id: "47814b7e-9762-42da-91ef-07755efcfa77", quantity: 2 }],
        p_zone_id: "55814b7e-9762-42da-91ef-07755efcfa88",
        p_purpose: "Hàn máng ăn chuồng 2",
        p_expected_return_date: "2026-09-12",
        p_borrower_id: "user-123",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/tools");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/products");
      expect(result).toBe("mock-borrowing-id");
    });

    it("throws error if RPC returns an error", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "Không đủ tồn kho" } });

      await expect(
        createToolBorrowing({
          items: [{ variantId: "47814b7e-9762-42da-91ef-07755efcfa77", quantity: 2 }],
          purpose: "Hàn khung quạt",
        }),
      ).rejects.toThrow("Không đủ tồn kho");
    });
  });

  describe("returnToolBorrowing", () => {
    it("calls return_tool_borrowing RPC with manager auth and revalidates paths", async () => {
      const input = {
        borrowingId: "47814b7e-9762-42da-91ef-07755efcfa77",
        items: [{ variantId: "55814b7e-9762-42da-91ef-07755efcfa88", quantity: 1 }],
        notes: "Dụng cụ tốt",
      };

      await returnToolBorrowing(input);

      expect(mockRequireManager).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith("return_tool_borrowing", {
        p_borrowing_id: "47814b7e-9762-42da-91ef-07755efcfa77",
        p_items: [{ variant_id: "55814b7e-9762-42da-91ef-07755efcfa88", quantity: 1 }],
        p_notes: "Dụng cụ tốt",
        p_by: "manager-456",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/tools");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/products");
    });

    it("throws error if RPC returns an error", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "Số lượng trả vượt quá số mượn" } });

      await expect(
        returnToolBorrowing({
          borrowingId: "47814b7e-9762-42da-91ef-07755efcfa77",
          items: [{ variantId: "55814b7e-9762-42da-91ef-07755efcfa88", quantity: 5 }],
        }),
      ).rejects.toThrow("Số lượng trả vượt quá số mượn");
    });
  });

  describe("cancelToolBorrowing", () => {
    it("calls cancel_tool_borrowing RPC and revalidates paths", async () => {
      await cancelToolBorrowing("47814b7e-9762-42da-91ef-07755efcfa77");

      expect(mockRequireProfile).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith("cancel_tool_borrowing", {
        p_borrowing_id: "47814b7e-9762-42da-91ef-07755efcfa77",
        p_by: "user-123",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/tools");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/products");
    });

    it("throws error if RPC returns an error", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "Phiếu đã có dụng cụ được trả" } });

      await expect(
        cancelToolBorrowing("47814b7e-9762-42da-91ef-07755efcfa77"),
      ).rejects.toThrow("Phiếu đã có dụng cụ được trả");
    });
  });
});
