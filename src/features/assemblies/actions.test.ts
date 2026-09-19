import { describe, it, expect, vi, beforeEach } from "vitest";
import { assemblyOrderSchema, disassemblyItemSchema, disassemblyOrderSchema } from "./schema";
import { executeAssembly, executeDisassembly, getSkuBomDetails } from "./actions";

// Mock dependencies
const mockRpc = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();
const mockRequireProfile = vi.fn();
const mockRequireManager = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
  revalidateTag: (tag: string) => mockRevalidateTag(tag),
}));

vi.mock("@/lib/auth", () => ({
  requireProfile: () => mockRequireProfile(),
  requireManager: () => mockRequireManager(),
}));

const mockAdminSupabase = {
  from: vi.fn(),
  rpc: mockRpc,
};

const mockServerSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminSupabase,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockServerSupabase),
}));

describe("Assembly & Disassembly Schemas", () => {
  const kitSkuId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const bomVersionId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
  const compLocId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
  const finishLocId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
  const compSkuId = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";

  describe("assemblyOrderSchema", () => {
    it("validates correct assembly input", () => {
      const valid = assemblyOrderSchema.safeParse({
        kitSkuId,
        bomVersionId,
        quantity: 5,
        componentLocationId: compLocId,
        finishedLocationId: finishLocId,
      });
      expect(valid.success).toBe(true);
    });

    it("rejects non-positive quantity", () => {
      const invalid = assemblyOrderSchema.safeParse({
        kitSkuId,
        bomVersionId,
        quantity: 0,
        componentLocationId: compLocId,
        finishedLocationId: finishLocId,
      });
      expect(invalid.success).toBe(false);
    });

    it("rejects invalid UUIDs", () => {
      const invalid = assemblyOrderSchema.safeParse({
        kitSkuId: "invalid-uuid",
        bomVersionId,
        quantity: 1,
        componentLocationId: compLocId,
        finishedLocationId: finishLocId,
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("disassemblyItemSchema & disassemblyOrderSchema", () => {
    it("validates correct disassembly input", () => {
      const valid = disassemblyOrderSchema.safeParse({
        kitSkuId,
        bomVersionId,
        quantity: 2,
        fromLocationId: finishLocId,
        items: [
          {
            componentSkuId: compSkuId,
            recoveredQuantity: 2,
            damagedQuantity: 0,
            lostQuantity: 0,
            recoveryLocationId: compLocId,
          },
        ],
      });
      expect(valid.success).toBe(true);
    });

    it("requires damagedLocationId when damagedQuantity > 0", () => {
      const invalid = disassemblyItemSchema.safeParse({
        componentSkuId: compSkuId,
        recoveredQuantity: 1,
        damagedQuantity: 1,
        lostQuantity: 0,
        recoveryLocationId: compLocId,
        damagedLocationId: null,
      });
      expect(invalid.success).toBe(false);
    });

    it("accepts damagedLocationId when damagedQuantity > 0", () => {
      const valid = disassemblyItemSchema.safeParse({
        componentSkuId: compSkuId,
        recoveredQuantity: 1,
        damagedQuantity: 1,
        lostQuantity: 0,
        recoveryLocationId: compLocId,
        damagedLocationId: compLocId,
      });
      expect(valid.success).toBe(true);
    });

    it("rejects empty items array in disassemblyOrderSchema", () => {
      const invalid = disassemblyOrderSchema.safeParse({
        kitSkuId,
        bomVersionId,
        quantity: 1,
        fromLocationId: finishLocId,
        items: [],
      });
      expect(invalid.success).toBe(false);
    });
  });
});

describe("Assembly & Disassembly Server Actions", () => {
  const kitSkuId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const bomVersionId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
  const compLocId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
  const finishLocId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
  const compSkuId = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";
  const bomHeaderId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireManager.mockResolvedValue({
      id: "user-warehouse-1",
      role: "warehouse",
    });
    mockRequireProfile.mockResolvedValue({
      id: "user-warehouse-1",
      role: "warehouse",
    });
  });

  describe("executeAssembly", () => {
    it("successfully calls post_assembly RPC and revalidates paths", async () => {
      // Mock db queries
      mockAdminSupabase.from.mockImplementation((table: string) => {
        if (table === "variants" || table === "skus") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: { id: kitSkuId, sku_code: "KIT-01", inventory_policy: "stocked_assembly" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "bom_headers") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: { id: bomHeaderId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "bom_versions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: { id: bomVersionId, status: "active" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) };
      });

      mockRpc.mockResolvedValue({ data: "movement-assembly-uuid", error: null });

      const res = await executeAssembly({
        kitSkuId,
        bomVersionId,
        quantity: 10,
        componentLocationId: compLocId,
        finishedLocationId: finishLocId,
      });

      expect(res.success).toBe(true);
      expect(res.movementId).toBe("movement-assembly-uuid");
      expect(mockRpc).toHaveBeenCalledWith("post_assembly", expect.objectContaining({
        p_kit_sku_id: kitSkuId,
        p_bom_version_id: bomVersionId,
        p_quantity: 10,
        p_component_location_id: compLocId,
        p_finished_location_id: finishLocId,
        p_actor: "user-warehouse-1",
      }));
      expect(mockRevalidatePath).toHaveBeenCalledWith("/assemblies");
    });

    it("rejects unauthorized role (e.g. technician or requester)", async () => {
      mockRequireManager.mockResolvedValue({
        id: "tech-1",
        role: "technician",
      });

      await expect(
        executeAssembly({
          kitSkuId,
          bomVersionId,
          quantity: 1,
          componentLocationId: compLocId,
          finishedLocationId: finishLocId,
        })
      ).rejects.toThrow("Bạn không có quyền");
    });

    it("rejects when SKU is not stocked_assembly", async () => {
      mockAdminSupabase.from.mockImplementation((table: string) => {
        if (table === "variants" || table === "skus") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: { id: kitSkuId, sku_code: "NORM-01", inventory_policy: "normal" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) };
      });

      await expect(
        executeAssembly({
          kitSkuId,
          bomVersionId,
          quantity: 1,
          componentLocationId: compLocId,
          finishedLocationId: finishLocId,
        })
      ).rejects.toThrow("không phải bộ ráp sẵn");
    });
  });

  describe("executeDisassembly", () => {
    it("successfully calls post_disassembly RPC when quantities match BOM", async () => {
      mockAdminSupabase.from.mockImplementation((table: string) => {
        if (table === "variants" || table === "skus") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: { id: kitSkuId, sku_code: "KIT-01", inventory_policy: "stocked_assembly" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "bom_headers") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: { id: bomHeaderId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "bom_versions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: { id: bomVersionId, status: "active" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "bom_items") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  { component_sku_id: compSkuId, base_quantity: 2 },
                ],
                error: null,
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) };
      });

      mockRpc.mockResolvedValue({ data: "movement-disassembly-uuid", error: null });

      // Disassemble 3 kits. Base quantity per kit is 2 => total expected = 6.
      // Recovered = 4, Damaged = 1, Lost = 1 => 4 + 1 + 1 = 6.
      const res = await executeDisassembly({
        kitSkuId,
        bomVersionId,
        quantity: 3,
        fromLocationId: finishLocId,
        items: [
          {
            componentSkuId: compSkuId,
            recoveredQuantity: 4,
            damagedQuantity: 1,
            lostQuantity: 1,
            recoveryLocationId: compLocId,
            damagedLocationId: compLocId,
          },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.movementId).toBe("movement-disassembly-uuid");
      expect(mockRpc).toHaveBeenCalledWith("post_disassembly", expect.objectContaining({
        p_kit_sku_id: kitSkuId,
        p_bom_version_id: bomVersionId,
        p_quantity: 3,
        p_from_location_id: finishLocId,
        p_items: [
          {
            component_sku_id: compSkuId,
            recovered_quantity: 4,
            damaged_quantity: 1,
            lost_quantity: 1,
            recovery_location_id: compLocId,
            damaged_location_id: compLocId,
          },
        ],
      }));
    });

    it("rejects when component recovery + damaged + lost does not equal BOM expected quantity", async () => {
      mockAdminSupabase.from.mockImplementation((table: string) => {
        if (table === "variants" || table === "skus") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: { id: kitSkuId, sku_code: "KIT-01", inventory_policy: "stocked_assembly" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "bom_headers") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: { id: bomHeaderId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "bom_versions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: { id: bomVersionId, status: "active" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "bom_items") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  { component_sku_id: compSkuId, base_quantity: 2 },
                ],
                error: null,
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) };
      });

      // Disassemble 3 kits => expected = 6. Provided sum = 3 (mismatch)
      await expect(
        executeDisassembly({
          kitSkuId,
          bomVersionId,
          quantity: 3,
          fromLocationId: finishLocId,
          items: [
            {
              componentSkuId: compSkuId,
              recoveredQuantity: 2,
              damagedQuantity: 1,
              lostQuantity: 0, // sum = 3, expected = 6
              recoveryLocationId: compLocId,
              damagedLocationId: compLocId,
            },
          ],
        })
      ).rejects.toThrow("không khớp định mức");
    });
  });

  describe("getSkuBomDetails", () => {
    it("returns null for non-existent SKU", async () => {
      mockServerSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: new Error("Not found") }),
          }),
        }),
      });

      const details = await getSkuBomDetails("non-existent-sku");
      expect(details).toBeNull();
    });
  });
});
