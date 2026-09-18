import { describe, it, expect, vi, beforeEach } from "vitest";
import { defectItemSchema, defectSchema } from "./schema";
import { recordDefect, updateDefect, cancelDefect } from "./actions";

// Mock dependencies
const mockRpc = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRequireProfile = vi.fn();
const mockNotifyUsers = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

vi.mock("@/lib/auth", () => ({
  requireProfile: () => mockRequireProfile(),
}));

vi.mock("@/lib/notifications", () => ({
  getManagerIds: vi.fn().mockResolvedValue(["mgr-1"]),
  notifyUsers: (...args: unknown[]) => mockNotifyUsers(...args),
}));

const mockAdminUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockAdminDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockAdminInsert = vi.fn().mockResolvedValue({ error: null });
const mockAdminSingle = vi.fn().mockResolvedValue({
  data: { id: "defect-1", code: "HONG-001", status: "staging", reported_by: "user-123" },
  error: null,
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockAdminSingle,
        }),
      }),
      update: mockAdminUpdate,
      delete: mockAdminDelete,
      insert: mockAdminInsert,
    })),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                code: "HONG-001",
                reported_by: "user-123",
                notes: "",
                source_location: { name: "Kho chính" },
              },
              error: null,
            }),
          }),
        }),
      })),
      rpc: (...args: unknown[]) => mockRpc(...args),
    }),
  ),
}));

describe("Defect Schemas", () => {
  const validSkuId = "47814b7e-9762-42da-91ef-07755efcfa77";
  const validLocId = "55814b7e-9762-42da-91ef-07755efcfa88";

  it("validates defect input correctly with skuId and enteredQuantity", () => {
    const valid = defectSchema.safeParse({
      sourceLocationId: validLocId,
      items: [
        {
          skuId: validSkuId,
          enteredQuantity: 3,
          damageDetail: "Bể vỡ đầu ren",
          images: ["https://example.com/img1.jpg"],
          note: "Giao nhận phát hiện vỡ",
        },
      ],
    });
    expect(valid.success).toBe(true);
  });

  it("validates legacy variantId and quantity", () => {
    const valid = defectSchema.safeParse({
      sourceLocationId: validLocId,
      items: [
        {
          variantId: validSkuId,
          quantity: 2,
          damageDetail: "Hỏng motor",
          images: ["https://example.com/img2.jpg"],
        },
      ],
    });
    expect(valid.success).toBe(true);
  });

  it("rejects defect item without images (must have >= 1 image)", () => {
    const invalid = defectItemSchema.safeParse({
      skuId: validSkuId,
      enteredQuantity: 1,
      damageDetail: "Gãy cánh quạt",
      images: [],
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects defect item with empty damage detail", () => {
    const invalid = defectItemSchema.safeParse({
      skuId: validSkuId,
      enteredQuantity: 1,
      damageDetail: "",
      images: ["https://example.com/img.jpg"],
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects defect item without skuId or variantId", () => {
    const invalid = defectItemSchema.safeParse({
      enteredQuantity: 1,
      damageDetail: "Nứt vỡ",
      images: ["https://example.com/img.jpg"],
    });
    expect(invalid.success).toBe(false);
  });
});

describe("Defect Server Actions", () => {
  const validSkuId = "47814b7e-9762-42da-91ef-07755efcfa77";
  const validLocId = "55814b7e-9762-42da-91ef-07755efcfa88";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireProfile.mockResolvedValue({
      id: "user-123",
      name: "Nguyễn Văn A",
      role: "warehouse",
    });
    mockRpc.mockResolvedValue({ data: "defect-uuid-1", error: null });
  });

  describe("recordDefect", () => {
    it("calls record_defect RPC and notifies managers", async () => {
      const input = {
        sourceLocationId: validLocId,
        items: [
          {
            skuId: validSkuId,
            enteredQuantity: 2,
            damageDetail: "Móp méo vỏ kim loại",
            note: "Do va chạm",
            images: ["https://example.com/photo.jpg"],
          },
        ],
      };

      const result = await recordDefect(input);

      expect(mockRequireProfile).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith("record_defect", {
        p_items: [
          {
            sku_id: validSkuId,
            variant_id: validSkuId,
            transaction_unit_id: null,
            entered_quantity: 2,
            quantity: 2,
            damage_detail: "Móp méo vỏ kim loại",
            damage_type: null,
            severity: null,
            images: ["https://example.com/photo.jpg"],
            note: "Do va chạm",
          },
        ],
        p_source_loc: validLocId,
        p_by: "user-123",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/defects");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/products");
      expect(result).toBe("defect-uuid-1");
    });
  });

  describe("updateDefect", () => {
    it("updates defect note items with sku_id and entered_quantity", async () => {
      const input = {
        sourceLocationId: validLocId,
        items: [
          {
            skuId: validSkuId,
            enteredQuantity: 5,
            damageDetail: "Cháy cuộn dây",
            images: ["https://example.com/pic.jpg"],
          },
        ],
      };

      await updateDefect("defect-1", input);

      expect(mockRequireProfile).toHaveBeenCalled();
      expect(mockAdminInsert).toHaveBeenCalledWith([
        {
          defect_note_id: "defect-1",
          variant_id: validSkuId,
          transaction_unit_id: null,
          entered_quantity: 5,
          quantity: 5,
          damage_detail: "Cháy cuộn dây",
          note: "",
          images: ["https://example.com/pic.jpg"],
        },
      ]);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/defects");
    });
  });

  describe("cancelDefect", () => {
    it("calls cancel_defect RPC and revalidates paths", async () => {
      await cancelDefect("defect-1");

      expect(mockRequireProfile).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith("cancel_defect", {
        p_id: "defect-1",
        p_by: "user-123",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/defects");
    });
  });
});
