import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchGeneralReportData,
  fetchZoneCostReportData,
  fetchVehicleReportData,
  fetchPartnersReportData,
  fetchStockCardData,
} from "./queries";

// Mock Supabase createClient
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe("Report Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchGeneralReportData", () => {
    it("fetches and aggregates general report data accurately", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "variants") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "var-1",
                  price: 100000,
                  unit: "cái",
                  attributes: { size: "L" },
                  min_stock: 5,
                  product_id: "prod-1",
                  products: { id: "prod-1", name: "Sản phẩm A", category_id: "cat-1", categories: { id: "cat-1", name: "Vật tư điện" } },
                },
              ],
              error: null,
            }),
          };
        }
        if (table === "stock_balances") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ variant_id: "var-1", quantity: 50 }],
                error: null,
              }),
              then: (fn: (res: { data: { variant_id: string; quantity: number }[]; error: null }) => unknown) =>
                fn({ data: [{ variant_id: "var-1", quantity: 50 }], error: null }),
            }),
          };
        }
        if (table === "stock_movements") {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
              then: (fn: (res: { data: unknown[]; error: null }) => unknown) => fn({ data: [], error: null }),
            }),
          };
        }
        if (table === "receipts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "rec-1",
                        status: "posted",
                        created_at: "2026-09-05T00:00:00Z",
                        receipt_items: [{ quantity: 10, unit_cost: 90000 }],
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "issues") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "iss-1",
                        status: "posted",
                        destination_type: "customer",
                        created_at: "2026-09-10T00:00:00Z",
                        issue_items: [{ quantity: 5, unit_price: 120000, variant_id: "var-1" }],
                      },
                      {
                        id: "iss-2",
                        status: "posted",
                        destination_type: "zone",
                        created_at: "2026-09-12T00:00:00Z",
                        issue_items: [{ quantity: 3, unit_price: 100000, variant_id: "var-1" }],
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "defect_notes") {
          return {
            select: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "def-1",
                        status: "staging",
                        created_at: "2026-09-15T00:00:00Z",
                        defect_note_items: [{ quantity: 2, unit_cost: 100000 }],
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "repair_orders") {
          return {
            select: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "rep-1",
                        status: "returned",
                        total_cost: 50000,
                        repair_order_items: [{ quantity: 1, cost: 50000, outcome: "returned_to_stock" }],
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "liquidation_notes") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "liq-1",
                        status: "completed",
                        liquidation_items: [{ quantity: 1, method: "sale", unit_value: 30000, proceeds: 35000 }],
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "fuel_receipts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [{ id: "fr-1", quantity: 500, unit_price: 20000, total_amount: 10000000 }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "fuel_dispenses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [{ id: "fd-1", quantity: 200 }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "fuel_types") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: "ft-1", current_stock: 1200 }],
                error: null,
              }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const res = await fetchGeneralReportData({
        from: "2026-09-01",
        to: "2026-09-30",
      });

      expect(res.totalInventoryValue).toBe(5000000); // 50 * 100000
      expect(res.totalImportValue).toBe(900000); // 10 * 90000
      expect(res.totalIssuedCost).toBe(300000); // 3 * 100000 (zone issue)
      expect(res.totalSalesRevenue).toBe(600000); // 5 * 120000 (customer issue)
      expect(res.stockLedger).toHaveLength(1);
      expect(res.stockLedger[0].closingQty).toBe(50);
      expect(res.categoryBreakdown).toEqual([
        { categoryName: "Vật tư điện", cost: 5000000, percentage: 100 },
      ]);
      expect(res.defectsSummary).toEqual({
        totalDefects: 2,
        repairedCount: 1,
        repairCost: 50000,
        liquidationRevenue: 35000,
      });
      expect(res.fuelSummary).toEqual({
        totalImportedLiters: 500,
        totalDispensedLiters: 200,
        currentTankStock: 1200,
        estimatedCost: 4000000, // 200 * (10000000 / 500 = 20000)
      });
    });
  });

  describe("fetchZoneCostReportData", () => {
    it("fetches zone costs and aggregates items", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "zones") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: "zone-1", name: "Khu A" },
                  { id: "zone-2", name: "Khu B" },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "issues") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "iss-1",
                          zone_id: "zone-1",
                          destination_type: "zone",
                          status: "posted",
                          zones: { name: "Khu A" },
                          issue_items: [
                            {
                              quantity: 10,
                              unit_price: 25000,
                              variant_id: "v1",
                              variants: {
                                unit: "cái",
                                attributes: { type: "Inox" },
                                products: { name: "Vòi nước" },
                              },
                            },
                          ],
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "defect_notes") {
          return {
            select: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "def-1",
                        status: "staging",
                        created_at: "2026-09-10T00:00:00Z",
                        reported_by: "u-1",
                        profiles: { zone_id: "zone-1" },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const res = await fetchZoneCostReportData({
        from: "2026-09-01",
        to: "2026-09-30",
      });

      expect(res.grandTotalCost).toBe(250000);
      expect(res.zones).toHaveLength(1);
      expect(res.zones[0].zoneId).toBe("zone-1");
      expect(res.zones[0].zoneName).toBe("Khu A");
      expect(res.zones[0].totalCost).toBe(250000);
      expect(res.zones[0].percentage).toBe(100);
      expect(res.zones[0].issueCount).toBe(1);
      expect(res.zones[0].defectCount).toBe(1);
      expect(res.zones[0].items[0].productName).toBe("Vòi nước");
      expect(res.zones[0].items[0].quantity).toBe(10);
    });
  });

  describe("fetchVehicleReportData", () => {
    it("fetches vehicle logs and calculates consumption", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "vehicles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "veh-1",
                      code: "XE-01",
                      name: "Xe Tải 5 Tấn",
                      odo_unit: "km",
                      fuel_norm: 18,
                      is_active: true,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "fuel_dispenses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "fd-1",
                        vehicle_id: "veh-1",
                        quantity: 40,
                        usage_diff: 200,
                        created_at: "2026-09-05T00:00:00Z",
                        status: "completed",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const res = await fetchVehicleReportData({
        from: "2026-09-01",
        to: "2026-09-30",
      });

      expect(res.totalLitersAllVehicles).toBe(40);
      expect(res.vehicles).toHaveLength(1);
      const veh = res.vehicles[0];
      expect(veh.vehicleId).toBe("veh-1");
      expect(veh.totalLiters).toBe(40);
      expect(veh.totalUsageDiff).toBe(200);
      expect(veh.avgRate).toBe(20); // (40 / 200) * 100 = 20 L/100km
      expect(veh.normDiff).toBe(2); // 20 - 18 = 2
      expect(veh.isOverNorm).toBe(true);
    });
  });

  describe("fetchPartnersReportData", () => {
    it("aggregates suppliers and customers data correctly", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "suppliers") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ id: "sup-1", name: "Công ty ABC", phone: "0901234567" }],
                error: null,
              }),
            }),
          };
        }
        if (table === "receipts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "rec-1",
                        supplier_id: "sup-1",
                        status: "posted",
                        created_at: "2026-09-05T00:00:00Z",
                        receipt_items: [{ quantity: 20, unit_cost: 50000 }],
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ id: "cust-1", name: "Trại Chăn Nuôi XYZ", phone: "0987654321" }],
                error: null,
              }),
            }),
          };
        }
        if (table === "issues") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "iss-1",
                          customer_id: "cust-1",
                          destination_type: "customer",
                          status: "posted",
                          created_at: "2026-09-10T00:00:00Z",
                          issue_items: [{ quantity: 10, unit_price: 75000 }],
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const res = await fetchPartnersReportData({
        from: "2026-09-01",
        to: "2026-09-30",
      });

      expect(res.suppliers).toHaveLength(1);
      expect(res.suppliers[0].supplierName).toBe("Công ty ABC");
      expect(res.suppliers[0].receiptCount).toBe(1);
      expect(res.suppliers[0].totalQuantity).toBe(20);
      expect(res.suppliers[0].totalAmount).toBe(1000000);

      expect(res.customers).toHaveLength(1);
      expect(res.customers[0].customerName).toBe("Trại Chăn Nuôi XYZ");
      expect(res.customers[0].issueCount).toBe(1);
      expect(res.customers[0].totalQuantity).toBe(10);
      expect(res.customers[0].totalRevenue).toBe(750000);
    });
  });

  describe("fetchStockCardData", () => {
    it("fetches single variant stock card with running balance and ref codes", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "variants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "var-1",
                    attributes: { color: "Trắng" },
                    unit: "cuộn",
                    products: { name: "Băng keo cách điện" },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "stock_locations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "loc-1", name: "Kho Chính" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "stock_balances") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ quantity: 80 }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "stock_movements") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "m-1",
                        variant_id: "var-1",
                        movement_type: "receipt_in",
                        quantity: 50,
                        ref_type: "receipt",
                        ref_id: "rec-1",
                        notes: "Nhập thêm",
                        created_by: "user-1",
                        created_at: "2026-09-05T10:00:00Z",
                        from_location_id: null,
                        to_location_id: "loc-1",
                      },
                      {
                        id: "m-2",
                        variant_id: "var-1",
                        movement_type: "issue_out",
                        quantity: 20,
                        ref_type: "issue",
                        ref_id: "iss-1",
                        notes: "Xuất dùng",
                        created_by: "user-1",
                        created_at: "2026-09-12T14:00:00Z",
                        from_location_id: "loc-1",
                        to_location_id: null,
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [{ id: "user-1", name: "Thủ kho Nguyễn" }],
              error: null,
            }),
          };
        }
        if (table === "receipts") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: "rec-1", code: "NK-2026-001" }],
                error: null,
              }),
            }),
          };
        }
        if (table === "issues") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: "iss-1", code: "XK-2026-001" }],
                error: null,
              }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const res = await fetchStockCardData({
        variantId: "var-1",
        locationId: "loc-1",
        from: "2026-09-01",
        to: "2026-09-30",
      });

      expect(res.variantId).toBe("var-1");
      expect(res.productName).toBe("Băng keo cách điện");
      expect(res.locationName).toBe("Kho Chính");
      expect(res.openingStock).toBe(50); // 80 (current) - (50 - 20) = 50
      expect(res.totalIn).toBe(50);
      expect(res.totalOut).toBe(20);
      expect(res.closingStock).toBe(80);
      expect(res.entries).toHaveLength(2);
      expect(res.entries[0].refCode).toBe("NK-2026-001");
      expect(res.entries[0].actorName).toBe("Thủ kho Nguyễn");
      expect(res.entries[0].runningBalance).toBe(100);
      expect(res.entries[1].refCode).toBe("XK-2026-001");
      expect(res.entries[1].runningBalance).toBe(80);
    });
  });
});
