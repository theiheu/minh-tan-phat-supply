 
import { describe, it, expect, vi } from "vitest";
import { ensureUnit, deleteProduct, saveBomComponents } from "./actions";

vi.mock("@/lib/auth", () => ({
  requireManager: vi.fn().mockResolvedValue({ id: "manager-user-id" }),
  requireProfile: vi.fn().mockResolvedValue({ id: "profile-user-id" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("ensureUnit", () => {
  it("resolves existing unit UUID directly if found", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "units") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" } }),
              })),
            })),
          };
        }
        return {};
      }),
    };

    const id = await ensureUnit("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", mockSupabase as any);
    expect(id).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
  });

  it("resolves 'Cái' by matching name/symbol/code", async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "units") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "cai-uuid", code: "cai", name: "Cái", symbol: "cái" },
                  { id: "bo-uuid", code: "bo", name: "Bộ", symbol: "bộ" },
                ],
              }),
            })),
          };
        }
        return {};
      }),
    };

    const id = await ensureUnit("Cái", mockSupabase as any);
    expect(id).toBe("cai-uuid");
  });

  it("creates a new unit when given an unlisted unit name", async () => {
    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: "new-lon-uuid" }, error: null }),
      })),
    }));

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "units") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "cai-uuid", code: "cai", name: "Cái", symbol: "cái" },
                ],
              }),
            })),
            insert: mockInsert,
          };
        }
        return {};
      }),
    };

    const id = await ensureUnit("Lon", mockSupabase as any);
    expect(id).toBe("new-lon-uuid");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Lon",
        symbol: "lon",
        code: "lon",
      })
    );
  });
});

describe("deleteProduct", () => {
  it("soft-deletes product and writes audit log", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const mockUpdate = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "products") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "prod-1", name: "Bóng đèn", catalog_status: "active" },
                  error: null,
                }),
              })),
            })),
            update: mockUpdate,
          };
        }
        if (table === "audit_logs") {
          return {
            insert: mockAuditInsert,
          };
        }
        return {};
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    await deleteProduct("prod-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
        updated_at: expect.any(String),
      })
    );
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "manager-user-id",
        action: "catalog.product.delete",
        entity_type: "product",
        entity_id: "prod-1",
        before: { name: "Bóng đèn", catalog_status: "active" },
      })
    );
  });
});

describe("saveBomComponents", () => {
  it("inserts bom_versions with draft status, inserts items, retires old version and activates new version", async () => {
    const { createClient } = await import("@/lib/supabase/server");

    const insertedVersions: any[] = [];
    const updatedVersions: any[] = [];
    const insertedItems: any[] = [];
    const updatedHeaders: any[] = [];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "variants" || table === "skus") {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: { product_id: "prod-123" }, error: null }),
                })),
                then: (resolve: any) => resolve({ error: null }),
              })),
            })),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { product_id: "prod-123", inventory_policy: "virtual_kit" } }),
              })),
            })),
          };
        }
        if (table === "bom_headers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "header-1", active_version_id: "v-old" } }),
              })),
            })),
            update: vi.fn((payload: any) => {
              updatedHeaders.push(payload);
              return { eq: vi.fn().mockResolvedValue({ error: null }) };
            }),
          };
        }
        if (table === "bom_versions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 1 }),
            })),
            insert: vi.fn((payload: any) => {
              insertedVersions.push(payload);
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: { id: "v-new-2" }, error: null }),
                })),
              };
            }),
            update: vi.fn((payload: any) => {
              updatedVersions.push(payload);
              return {
                eq: vi.fn((_col: string, _val: string) => ({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                  then: (resolve: any) => resolve({ error: null }),
                })),
              };
            }),
          };
        }
        if (table === "bom_items") {
          return {
            insert: vi.fn((payload: any) => {
              insertedItems.push(payload);
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === "audit_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    await saveBomComponents(
      "sku-123",
      [{ componentSkuId: "comp-sku-1", baseQuantity: 2 }],
      "virtual_kit"
    );

    // 1. Must insert draft status first to satisfy RLS bom_versions_insert
    expect(insertedVersions[0]).toEqual(
      expect.objectContaining({
        bom_header_id: "header-1",
        version_number: 2,
        status: "draft",
      })
    );

    // 2. Must insert items while draft
    expect(insertedItems[0]).toEqual(
      expect.objectContaining({
        bom_version_id: "v-new-2",
        component_sku_id: "comp-sku-1",
        base_quantity: 2,
      })
    );

    // 3. Must retire old active version and activate new version
    expect(updatedVersions).toContainEqual({ status: "retired" });
    expect(updatedVersions).toContainEqual({ status: "active" });
  });
});


import { updateProductAxes, addSku } from "./actions";

describe("updateProductAxes", () => {
  it("creates attribute definitions and updates product_attribute_definitions", async () => {
    const { createClient } = await import("@/lib/supabase/server");

    const insertedDefinitions: any[] = [];
    const insertedProdDefs: any[] = [];
    const _deletedProdDefs: any[] = [];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "attribute_definitions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              })),
              ilike: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              })),
            })),
            insert: vi.fn((payload: any) => {
              insertedDefinitions.push(payload);
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "def-uuid-" + payload.code, name: payload.name, code: payload.code, data_type: payload.data_type },
                    error: null,
                  }),
                })),
              };
            }),
          };
        }
        if (table === "product_attribute_definitions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockReturnValue({
                data: [{ id: "pad-old", attribute_definition_id: "def-old" }],
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { display_order: 1 } }),
                }),
              }),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
            upsert: vi.fn((payload: any) => {
              insertedProdDefs.push(payload);
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === "variants" || table === "skus") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [{ id: "sku-1" }] }),
            })),
          };
        }
        if (table === "sku_attribute_values") {
          return {
            delete: vi.fn(() => ({
              in: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          };
        }
        if (table === "audit_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    await updateProductAxes({
      productId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      axes: ["Hãng sản xuất", "Mã vòng bi"],
    });

    expect(insertedDefinitions.length).toBe(2);
    expect(insertedDefinitions[0].name).toBe("Hãng sản xuất");
    expect(insertedDefinitions[1].name).toBe("Mã vòng bi");
    expect(insertedProdDefs.length).toBe(2);
    expect(insertedProdDefs[0]).toEqual(
      expect.objectContaining({
        product_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        display_order: 0,
      })
    );
  });
});

describe("addSku and updateSku attribute synchronization", () => {
  it("persists minStock, price, and resolves dynamic attributes when adding a SKU", async () => {
    const { createClient } = await import("@/lib/supabase/server");

    let insertedVariant: any = null;
    let insertedSkuAttrValues: any = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "units") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" } }),
              })),
            })),
          };
        }
        if (table === "products") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { name: "Vòng bi cầu" } }),
              })),
            })),
          };
        }
        if (table === "variants" || table === "skus") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            })),
            insert: vi.fn((payload: any) => {
              insertedVariant = payload;
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "new-sku-1", sku_code: payload.sku_code, product_id: payload.product_id },
                    error: null,
                  }),
                })),
              };
            }),
          };
        }
        if (table === "attribute_definitions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "def-qc", name: "Quy cách", code: "quy_cach", data_type: "text" } }),
              })),
              ilike: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "def-qc", name: "Quy cách", code: "quy_cach", data_type: "text" } }),
              })),
            })),
          };
        }
        if (table === "product_attribute_definitions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { display_order: 0 } }),
                })),
              })),
            })),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === "sku_attribute_values") {
          return {
            upsert: vi.fn((payload: any) => {
              insertedSkuAttrValues = payload;
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === "sku_transaction_units") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === "audit_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    await addSku({
      productId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      baseUnitId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      minStock: 25,
      price: 150000,
      trackingPolicy: "none",
      inventoryPolicy: "normal",
      allowFraction: false,
      images: [],
      attributeValues: [
        {
          attributeName: "Quy cách",
          textValue: "6205-2RS",
        },
      ],
    });

    expect(insertedVariant).toEqual(
      expect.objectContaining({
        product_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        base_unit_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        min_stock: 25,
        price: 150000,
      })
    );

    expect(insertedSkuAttrValues).toEqual(
      expect.objectContaining({
        sku_id: "new-sku-1",
        attribute_definition_id: "def-qc",
        text_value: "6205-2RS",
      })
    );
  });
});