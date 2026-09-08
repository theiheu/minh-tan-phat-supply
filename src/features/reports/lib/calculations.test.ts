import { describe, it, expect } from "vitest";
import {
  calculateStockLedger,
  calculateVehicleConsumption,
  calculateZoneCosts,
  calculateStockCardEntries,
  getDateRangeFromPreset,
} from "./calculations";

describe("Report calculations", () => {
  describe("calculateStockLedger", () => {
    it("calculates opening stock, period movements, and closing stock correctly", () => {
      const currentBalances = new Map<string, number>([["var-1", 100]]);
      const movements = [
        {
          variant_id: "var-1",
          movement_type: "receipt_in",
          quantity: 50,
          created_at: "2026-09-10T10:00:00Z",
        },
        {
          variant_id: "var-1",
          movement_type: "issue_out",
          quantity: 20,
          created_at: "2026-09-15T10:00:00Z",
        },
      ];

      const result = calculateStockLedger(
        movements,
        currentBalances,
        "2026-09-01T00:00:00Z",
        "2026-09-30T23:59:59Z"
      );

      const row = result.get("var-1");
      expect(row).toBeDefined();
      expect(row?.openingQty).toBe(70);
      expect(row?.inQty).toBe(50);
      expect(row?.outQty).toBe(20);
      expect(row?.netChange).toBe(30);
      expect(row?.closingQty).toBe(100);
    });

    it("correctly handles movements before, during, and after the date range", () => {
      // Current balance today (after all movements) = 130
      const currentBalances = new Map<string, number>([["var-1", 130]]);
      const movements = [
        // Before period (August): +40
        {
          variant_id: "var-1",
          movement_type: "receipt_in",
          quantity: 40,
          created_at: "2026-08-15T10:00:00Z",
        },
        // In period (September): +50 in, -10 out => net +40
        {
          variant_id: "var-1",
          movement_type: "receipt_in",
          quantity: 50,
          created_at: "2026-09-05T10:00:00Z",
        },
        {
          variant_id: "var-1",
          movement_type: "issue_out",
          quantity: 10,
          created_at: "2026-09-20T10:00:00Z",
        },
        // After period (October): +50 in
        {
          variant_id: "var-1",
          movement_type: "receipt_in",
          quantity: 50,
          created_at: "2026-10-02T10:00:00Z",
        },
      ];

      const result = calculateStockLedger(
        movements,
        currentBalances,
        "2026-09-01",
        "2026-09-30"
      );

      const row = result.get("var-1");
      expect(row).toBeDefined();
      // Current = 130. Post-period movements = +50.
      // Closing stock at end of Sep = 130 - 50 = 80.
      // In-period net change = +40 (+50 - 10).
      // Opening stock at start of Sep = 80 - 40 = 40.
      expect(row?.openingQty).toBe(40);
      expect(row?.inQty).toBe(50);
      expect(row?.outQty).toBe(10);
      expect(row?.netChange).toBe(40);
      expect(row?.closingQty).toBe(80);
    });

    it("handles all IN and OUT movement types", () => {
      const currentBalances = new Map<string, number>([["var-2", 200]]);
      const movements = [
        { variant_id: "var-2", movement_type: "receipt_in", quantity: 10, created_at: "2026-09-02T00:00:00Z" },
        { variant_id: "var-2", movement_type: "return_in", quantity: 5, created_at: "2026-09-03T00:00:00Z" },
        { variant_id: "var-2", movement_type: "repair_return_in", quantity: 3, created_at: "2026-09-04T00:00:00Z" },
        { variant_id: "var-2", movement_type: "adjustment_in", quantity: 2, created_at: "2026-09-05T00:00:00Z" },
        { variant_id: "var-2", movement_type: "defect_collect_in", quantity: 4, created_at: "2026-09-06T00:00:00Z" },
        { variant_id: "var-2", movement_type: "tool_return_in", quantity: 1, created_at: "2026-09-07T00:00:00Z" },

        { variant_id: "var-2", movement_type: "issue_out", quantity: 6, created_at: "2026-09-08T00:00:00Z" },
        { variant_id: "var-2", movement_type: "requisition_out", quantity: 4, created_at: "2026-09-09T00:00:00Z" },
        { variant_id: "var-2", movement_type: "defect_out", quantity: 2, created_at: "2026-09-10T00:00:00Z" },
        { variant_id: "var-2", movement_type: "repair_out", quantity: 3, created_at: "2026-09-11T00:00:00Z" },
        { variant_id: "var-2", movement_type: "liquidation_out", quantity: 1, created_at: "2026-09-12T00:00:00Z" },
        { variant_id: "var-2", movement_type: "adjustment_out", quantity: 1, created_at: "2026-09-13T00:00:00Z" },
        { variant_id: "var-2", movement_type: "exchange_out", quantity: 2, created_at: "2026-09-14T00:00:00Z" },
        { variant_id: "var-2", movement_type: "tool_borrow_out", quantity: 1, created_at: "2026-09-15T00:00:00Z" },
      ];

      const result = calculateStockLedger(
        movements,
        currentBalances,
        "2026-09-01T00:00:00Z",
        "2026-09-30T23:59:59Z"
      );

      const row = result.get("var-2");
      expect(row).toBeDefined();
      // Total In = 10 + 5 + 3 + 2 + 4 + 1 = 25
      expect(row?.inQty).toBe(25);
      // Total Out = 6 + 4 + 2 + 3 + 1 + 1 + 2 + 1 = 20
      expect(row?.outQty).toBe(20);
      expect(row?.netChange).toBe(5);
      expect(row?.closingQty).toBe(200);
      expect(row?.openingQty).toBe(195);
    });

    it("includes variants that have current balance but no movements in period", () => {
      const currentBalances = new Map<string, number>([
        ["var-idle", 50],
      ]);
      const movements: Array<{
        variant_id: string;
        movement_type: string;
        quantity: number;
        created_at: string;
      }> = [];

      const result = calculateStockLedger(
        movements,
        currentBalances,
        "2026-09-01T00:00:00Z",
        "2026-09-30T23:59:59Z"
      );

      const row = result.get("var-idle");
      expect(row).toBeDefined();
      expect(row?.openingQty).toBe(50);
      expect(row?.inQty).toBe(0);
      expect(row?.outQty).toBe(0);
      expect(row?.netChange).toBe(0);
      expect(row?.closingQty).toBe(50);
    });
  });

  describe("calculateVehicleConsumption", () => {
    it("calculates vehicle consumption rate and warns on over-norm for km vehicles", () => {
      const vehicles = [
        { id: "v1", code: "XE-01", name: "Xe ben chở phân", odo_unit: "km" as const, fuel_norm: 15, plate: "61C-123.45" },
      ];
      const logs = [
        {
          vehicle_id: "v1",
          quantity: 35,
          usage_diff: 200,
          created_at: "2026-09-05T08:00:00Z",
        },
      ];

      const result = calculateVehicleConsumption(logs, vehicles);
      expect(result).toHaveLength(1);
      expect(result[0].vehicleId).toBe("v1");
      expect(result[0].code).toBe("XE-01");
      expect(result[0].plate).toBe("61C-123.45");
      expect(result[0].totalLiters).toBe(35);
      expect(result[0].dispenseCount).toBe(1);
      expect(result[0].totalUsageDiff).toBe(200);
      // (35 / 200) * 100 = 17.5 L/100km
      expect(result[0].avgRate).toBe(17.5);
      expect(result[0].normDiff).toBe(2.5);
      expect(result[0].isOverNorm).toBe(true);
    });

    it("calculates vehicle consumption rate for hours machinery (e.g. generator)", () => {
      const vehicles = [
        { id: "m1", code: "MP-01", name: "Máy phát điện Cummins", odo_unit: "hours" as const, fuel_norm: 12 },
      ];
      const logs = [
        { vehicle_id: "m1", quantity: 50, usage_diff: 5, created_at: "2026-09-02T08:00:00Z" },
        { vehicle_id: "m1", quantity: 40, usage_diff: 5, created_at: "2026-09-08T08:00:00Z" },
      ];

      const result = calculateVehicleConsumption(logs, vehicles);
      expect(result).toHaveLength(1);
      expect(result[0].totalLiters).toBe(90);
      expect(result[0].dispenseCount).toBe(2);
      expect(result[0].totalUsageDiff).toBe(10);
      // 90 / 10 = 9 L/hour
      expect(result[0].avgRate).toBe(9);
      expect(result[0].normDiff).toBe(-3);
      expect(result[0].isOverNorm).toBe(false);
    });

    it("handles zero usage diff or null fuel norm gracefully", () => {
      const vehicles = [
        { id: "v2", code: "XE-02", name: "Xe tải nhỏ", odo_unit: "km" as const, fuel_norm: null },
      ];
      const logs = [
        { vehicle_id: "v2", quantity: 20, usage_diff: 0, created_at: "2026-09-02T08:00:00Z" },
      ];

      const result = calculateVehicleConsumption(logs, vehicles);
      expect(result[0].totalLiters).toBe(20);
      expect(result[0].totalUsageDiff).toBe(0);
      expect(result[0].avgRate).toBeNull();
      expect(result[0].normDiff).toBeNull();
      expect(result[0].isOverNorm).toBe(false);
    });
  });

  describe("calculateZoneCosts", () => {
    it("aggregates total cost and items breakdown per zone", () => {
      const issues = [
        {
          id: "issue-1",
          zone_id: "zone-a",
          zone_name: "Khu Chuồng A1",
          items: [
            {
              product_name: "Bóng đèn sưởi hồng ngoại",
              variant_label: "100W",
              unit: "cái",
              quantity: 10,
              unit_price: 35000,
              total_amount: 350000,
            },
            {
              product_name: "Cáp kéo phân",
              variant_label: "Phi 8",
              unit: "mét",
              quantity: 20,
              unit_price: 15000,
              total_amount: 300000,
            },
          ],
        },
        {
          id: "issue-2",
          zone_id: "zone-a",
          zone_name: "Khu Chuồng A1",
          items: [
            {
              product_name: "Bóng đèn sưởi hồng ngoại",
              variant_label: "100W",
              unit: "cái",
              quantity: 5,
              unit_price: 35000,
              total_amount: 175000,
            },
          ],
        },
        {
          id: "issue-3",
          zone_id: "zone-b",
          zone_name: "Khu Chuồng B1",
          items: [
            {
              product_name: "Núm uống nước tự động",
              variant_label: "Inox 304",
              unit: "cái",
              quantity: 10,
              unit_price: 17500,
              total_amount: 175000,
            },
          ],
        },
      ];

      const defects = [
        { id: "def-1", zone_id: "zone-a" },
      ];

      const result = calculateZoneCosts(issues, defects);
      expect(result.grandTotalCost).toBe(1000000);
      expect(result.zones).toHaveLength(2);

      const zoneA = result.zones.find((z) => z.zoneId === "zone-a");
      expect(zoneA).toBeDefined();
      expect(zoneA?.totalCost).toBe(825000); // 350k + 300k + 175k
      expect(zoneA?.percentage).toBe(82.5);
      expect(zoneA?.issueCount).toBe(2);
      expect(zoneA?.defectCount).toBe(1);
      // Verify items grouped
      expect(zoneA?.items).toHaveLength(2);
      const bulbItem = zoneA?.items.find((i) => i.productName.includes("Bóng đèn"));
      expect(bulbItem?.quantity).toBe(15);
      expect(bulbItem?.totalAmount).toBe(525000);

      const zoneB = result.zones.find((z) => z.zoneId === "zone-b");
      expect(zoneB?.totalCost).toBe(175000);
      expect(zoneB?.percentage).toBe(17.5);
      expect(zoneB?.issueCount).toBe(1);
      expect(zoneB?.defectCount).toBe(0);
    });

    it("handles empty issues and defects gracefully", () => {
      const result = calculateZoneCosts([], []);
      expect(result.grandTotalCost).toBe(0);
      expect(result.zones).toEqual([]);
    });
  });

  describe("calculateStockCardEntries", () => {
    it("computes running balance chronologically", () => {
      const openingStock = 100;
      const rawEntries = [
        {
          id: "e1",
          created_at: "2026-09-02T10:00:00Z",
          ref_type: "receipt",
          ref_code: "NK-001",
          movement_type: "receipt_in",
          notes: "Nhập hàng nhà cung cấp",
          actor_name: "Admin",
          quantity: 50,
        },
        {
          id: "e2",
          created_at: "2026-09-05T14:00:00Z",
          ref_type: "issue",
          ref_code: "XK-001",
          movement_type: "issue_out",
          notes: "Xuất dùng khu A",
          actor_name: "Nguyễn Văn A",
          quantity: 30,
        },
        {
          id: "e3",
          created_at: "2026-09-10T09:00:00Z",
          ref_type: "defect",
          ref_code: "HH-001",
          movement_type: "defect_out",
          notes: "Chuyển kho hỏng",
          actor_name: "Trần B",
          quantity: 5,
        },
      ];

      const result = calculateStockCardEntries(rawEntries, openingStock);
      expect(result.entries).toHaveLength(3);
      expect(result.totalIn).toBe(50);
      expect(result.totalOut).toBe(35);
      expect(result.closingStock).toBe(115);

      expect(result.entries[0].inQty).toBe(50);
      expect(result.entries[0].outQty).toBe(0);
      expect(result.entries[0].runningBalance).toBe(150);

      expect(result.entries[1].inQty).toBe(0);
      expect(result.entries[1].outQty).toBe(30);
      expect(result.entries[1].runningBalance).toBe(120);

      expect(result.entries[2].inQty).toBe(0);
      expect(result.entries[2].outQty).toBe(5);
      expect(result.entries[2].runningBalance).toBe(115);
    });
  });

  describe("getDateRangeFromPreset", () => {
    it("returns correct ranges for presets", () => {
      const baseDate = new Date("2026-09-15T12:00:00Z");
      const todayRange = getDateRangeFromPreset("today", baseDate);
      expect(todayRange.from).toBe("2026-09-15");
      expect(todayRange.to).toBe("2026-09-15");

      const monthRange = getDateRangeFromPreset("this_month", baseDate);
      expect(monthRange.from).toBe("2026-09-01");
      expect(monthRange.to).toBe("2026-09-30");

      const lastMonthRange = getDateRangeFromPreset("last_month", baseDate);
      expect(lastMonthRange.from).toBe("2026-08-01");
      expect(lastMonthRange.to).toBe("2026-08-31");

      const yearRange = getDateRangeFromPreset("this_year", baseDate);
      expect(yearRange.from).toBe("2026-01-01");
      expect(yearRange.to).toBe("2026-12-31");

      const quarterRange = getDateRangeFromPreset("this_quarter", baseDate);
      expect(quarterRange.from).toBe("2026-07-01");
      expect(quarterRange.to).toBe("2026-09-30");

      const sevenDaysRange = getDateRangeFromPreset("7days", baseDate);
      expect(sevenDaysRange.from).toBe("2026-09-09");
      expect(sevenDaysRange.to).toBe("2026-09-15");
    });
  });

  describe("Edge cases & defensive handling", () => {
    it("handles unordered stock card entries properly", () => {
      const openingStock = 50;
      const unordered = [
        { id: "e2", created_at: "2026-09-10T10:00:00Z", movement_type: "issue_out", quantity: 20 },
        { id: "e1", created_at: "2026-09-01T10:00:00Z", movement_type: "receipt_in", quantity: 100 },
      ];
      const res = calculateStockCardEntries(unordered, openingStock);
      expect(res.entries[0].id).toBe("e1");
      expect(res.entries[0].runningBalance).toBe(150);
      expect(res.entries[1].id).toBe("e2");
      expect(res.entries[1].runningBalance).toBe(130);
      expect(res.closingStock).toBe(130);
    });

    it("calculates stock ledger without currentBalances map using before-period history", () => {
      const movements = [
        { variant_id: "v-nb", movement_type: "receipt_in", quantity: 80, created_at: "2026-08-01T00:00:00Z" },
        { variant_id: "v-nb", movement_type: "issue_out", quantity: 30, created_at: "2026-08-15T00:00:00Z" },
        { variant_id: "v-nb", movement_type: "receipt_in", quantity: 40, created_at: "2026-09-10T00:00:00Z" },
      ];
      const result = calculateStockLedger(movements, new Map(), "2026-09-01", "2026-09-30");
      const row = result.get("v-nb");
      expect(row?.openingQty).toBe(50); // 80 - 30
      expect(row?.inQty).toBe(40);
      expect(row?.outQty).toBe(0);
      expect(row?.closingQty).toBe(90);
    });

    it("handles vehicles with no logs or empty inputs", () => {
      const result = calculateVehicleConsumption([], []);
      expect(result).toEqual([]);
    });
  });
});
