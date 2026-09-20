import { describe, expect, it } from "vitest";
import type { GeneralReportData, VehicleReportData, ZoneCostReportData } from "../types";
import { buildManagementAlerts } from "./management-insights";

const general: GeneralReportData = {
  totalInventoryValue: 1, totalImportValue: 2, totalIssuedCost: 3, totalSalesRevenue: 4,
  stockLedger: [], categoryBreakdown: [],
  defectsSummary: { totalDefects: 4, repairedCount: 1, repairCost: 0, liquidationRevenue: 0 },
  fuelSummary: { totalImportedLiters: 0, totalDispensedLiters: 0, currentTankStock: 0, estimatedCost: 0 },
};
const zones: ZoneCostReportData = { grandTotalCost: 100, zones: [{ zoneId: "z1", zoneName: "Trại A", totalCost: 60, percentage: 60, issueCount: 8, defectCount: 0, items: [] }] };
const vehicles: VehicleReportData = { totalLitersAllVehicles: 10, vehicles: [{ vehicleId: "v1", code: "XE-01", name: "Xe tải", plate: null, odoUnit: "km", fuelNorm: 10, totalLiters: 10, dispenseCount: 1, totalUsageDiff: 50, avgRate: 20, normDiff: 25, isOverNorm: true }] };

describe("buildManagementAlerts", () => {
  it("orders critical operational signals before warnings", () => {
    const alerts = buildManagementAlerts({ general, zones, vehicles });
    expect(alerts.slice(0, 2).map((alert) => alert.severity)).toEqual(["critical", "critical"]);
    expect(alerts[0].targetReport).toBe("vehicles");
  });

  it("returns a stable informational state when no signal has evidence", () => {
    const alerts = buildManagementAlerts({
      general: { ...general, defectsSummary: { ...general.defectsSummary, totalDefects: 0, repairedCount: 0 } },
      zones: { grandTotalCost: 0, zones: [] },
      vehicles: { totalLitersAllVehicles: 0, vehicles: [] },
    });
    expect(alerts).toEqual([expect.objectContaining({ id: "stable-period", severity: "info" })]);
  });

  it("respects the visible alert limit", () => {
    expect(buildManagementAlerts({ general, zones, vehicles, limit: 1 })).toHaveLength(1);
  });
});
