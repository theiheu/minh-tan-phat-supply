import type {
  GeneralReportData,
  ManagementAlert,
  VehicleReportData,
  ZoneCostReportData,
} from "../types";

const severityRank = { critical: 0, warning: 1, info: 2 } as const;

export function buildManagementAlerts(input: {
  general: GeneralReportData;
  zones: ZoneCostReportData;
  vehicles: VehicleReportData;
  limit?: number;
}): ManagementAlert[] {
  const { zones, vehicles, limit = 7 } = input;
  const alerts: ManagementAlert[] = [];

  for (const vehicle of vehicles.vehicles.filter((item) => item.isOverNorm)) {
    alerts.push({
      id: `vehicle-over-norm-${vehicle.vehicleId}`,
      severity: vehicle.fuelNorm && vehicle.avgRate && vehicle.avgRate / vehicle.fuelNorm >= 1.2 ? "critical" : "warning",
      title: `${vehicle.code} vượt định mức nhiên liệu`,
      description: vehicle.name,
      value: vehicle.fuelNorm && vehicle.avgRate
        ? `+${(((vehicle.avgRate - vehicle.fuelNorm) / vehicle.fuelNorm) * 100).toFixed(1)}%`
        : "Vượt định mức",
      targetSection: "operations",
      targetReport: "vehicles",
    });
  }

  const dominantZone = zones.zones
    .filter((zone) => zone.totalCost > 0 && zone.percentage >= 40)
    .sort((a, b) => b.percentage - a.percentage)[0];
  if (dominantZone) {
    alerts.push({
      id: `zone-cost-${dominantZone.zoneId}`,
      severity: dominantZone.percentage >= 60 ? "critical" : "warning",
      title: `Chi phí tập trung tại ${dominantZone.zoneName}`,
      description: `Chiếm ${dominantZone.percentage.toFixed(1)}% tổng chi phí vật tư trong kỳ`,
      value: `${dominantZone.issueCount} lượt cấp`,
      targetSection: "operations",
      targetReport: "zones",
    });
  }


  if (alerts.length === 0) {
    alerts.push({
      id: "stable-period",
      severity: "info",
      title: "Chưa phát hiện tín hiệu bất thường",
      description: "Các chỉ số có dữ liệu đang nằm trong ngưỡng theo dõi",
      value: "Ổn định",
      targetSection: "overview",
    });
  }

  return alerts
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id))
    .slice(0, limit);
}
