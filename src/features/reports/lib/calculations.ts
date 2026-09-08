import { MOVEMENT_TYPE } from "@/lib/labels";
import type {
  DatePreset,
  StockCardEntry,
  StockLedgerCalculation,
  VehicleUsageRow,
  ZoneCostReportData,
  ZoneCostRow,
} from "../types";

export const IN_MOVEMENT_TYPES = new Set([
  "receipt_in",
  "return_in",
  "repair_return_in",
  "adjustment_in",
  "defect_collect_in",
  "tool_return_in",
]);

export const OUT_MOVEMENT_TYPES = new Set([
  "issue_out",
  "requisition_out",
  "exchange_out",
  "defect_out",
  "repair_out",
  "liquidation_out",
  "adjustment_out",
  "tool_borrow_out",
]);

export function isStockIn(movementType: string): boolean {
  return IN_MOVEMENT_TYPES.has(movementType) || movementType.endsWith("_in");
}

export function isStockOut(movementType: string): boolean {
  return OUT_MOVEMENT_TYPES.has(movementType) || movementType.endsWith("_out");
}

export function parseDateBoundary(dateStr: string, isEnd = false): number {
  if (!dateStr) return isEnd ? Infinity : -Infinity;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T${isEnd ? "23:59:59.999" : "00:00:00.000"}Z`).getTime();
  }
  return new Date(dateStr).getTime();
}

export interface MovementInput {
  variant_id?: string;
  variantId?: string;
  movement_type?: string;
  movementType?: string;
  quantity: number;
  created_at?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Calculates opening stock, in-period ins/outs, and closing stock for variants.
 */
export function calculateStockLedger(
  movements: MovementInput[],
  currentBalances: Map<string, number> = new Map(),
  fromDate: string,
  toDate: string
): Map<string, StockLedgerCalculation> {
  const fromTime = parseDateBoundary(fromDate, false);
  const toTime = parseDateBoundary(toDate, true);

  type VariantLedgerAcc = {
    beforeIn: number;
    beforeOut: number;
    periodIn: number;
    periodOut: number;
    afterIn: number;
    afterOut: number;
  };

  const map = new Map<string, VariantLedgerAcc>();

  const getOrCreate = (variantId: string): VariantLedgerAcc => {
    let entry = map.get(variantId);
    if (!entry) {
      entry = {
        beforeIn: 0,
        beforeOut: 0,
        periodIn: 0,
        periodOut: 0,
        afterIn: 0,
        afterOut: 0,
      };
      map.set(variantId, entry);
    }
    return entry;
  };

  // Seed all variants from currentBalances
  for (const variantId of currentBalances.keys()) {
    getOrCreate(variantId);
  }

  for (const m of movements) {
    const variantId = m.variant_id || m.variantId;
    if (!variantId) continue;

    const mType = m.movement_type || m.movementType || "";
    const qty = Math.abs(Number(m.quantity) || 0);
    const createdAtStr = m.created_at || m.createdAt || "";
    const time = createdAtStr ? new Date(createdAtStr).getTime() : 0;

    const isIn = isStockIn(mType);
    const isOut = isStockOut(mType);
    if (!isIn && !isOut) continue;

    const acc = getOrCreate(variantId);

    if (time < fromTime) {
      if (isIn) acc.beforeIn += qty;
      if (isOut) acc.beforeOut += qty;
    } else if (time > toTime) {
      if (isIn) acc.afterIn += qty;
      if (isOut) acc.afterOut += qty;
    } else {
      if (isIn) acc.periodIn += qty;
      if (isOut) acc.periodOut += qty;
    }
  }

  const result = new Map<string, StockLedgerCalculation>();

  for (const [variantId, acc] of map.entries()) {
    const netPeriod = acc.periodIn - acc.periodOut;
    const netAfter = acc.afterIn - acc.afterOut;
    const netBefore = acc.beforeIn - acc.beforeOut;

    let openingQty: number;
    let closingQty: number;

    const currentBal = currentBalances.get(variantId);

    if (currentBal !== undefined) {
      closingQty = currentBal - netAfter;
      openingQty = closingQty - netPeriod;
    } else {
      openingQty = netBefore;
      closingQty = openingQty + netPeriod;
    }

    result.set(variantId, {
      variantId,
      openingQty,
      inQty: acc.periodIn,
      outQty: acc.periodOut,
      closingQty,
      netChange: netPeriod,
    });
  }

  return result;
}

export interface VehicleInput {
  id?: string;
  vehicleId?: string;
  code: string;
  name: string;
  plate?: string | null;
  odo_unit?: "km" | "hours" | string | null;
  odoUnit?: "km" | "hours" | string | null;
  fuel_norm?: number | null;
  fuelNorm?: number | null;
  [key: string]: unknown;
}

export interface FuelLogInput {
  vehicle_id?: string | null;
  vehicleId?: string | null;
  quantity: number;
  usage_diff?: number | null;
  usageDiff?: number | null;
  created_at?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Calculates fuel consumption per vehicle and compares against norm.
 */
export function calculateVehicleConsumption(
  logs: FuelLogInput[],
  vehicles: VehicleInput[]
): VehicleUsageRow[] {
  const logsByVehicle = new Map<string, FuelLogInput[]>();

  for (const log of logs) {
    const vId = log.vehicle_id || log.vehicleId;
    if (!vId) continue;
    let list = logsByVehicle.get(vId);
    if (!list) {
      list = [];
      logsByVehicle.set(vId, list);
    }
    list.push(log);
  }

  return vehicles.map((v) => {
    const vehicleId = (v.id || v.vehicleId || "") as string;
    const code = v.code || "";
    const name = v.name || "";
    const plate = v.plate ?? null;
    const odoUnit = ((v.odo_unit || v.odoUnit || "km") as string).toLowerCase() === "hours" ? "hours" : "km";
    const fuelNorm =
      v.fuel_norm !== undefined
        ? (v.fuel_norm === null ? null : Number(v.fuel_norm))
        : v.fuelNorm !== undefined
          ? (v.fuelNorm === null ? null : Number(v.fuelNorm))
          : null;

    const vLogs = logsByVehicle.get(vehicleId) ?? [];
    const dispenseCount = vLogs.length;

    let totalLiters = 0;
    let totalUsageDiff = 0;

    for (const l of vLogs) {
      totalLiters += Number(l.quantity) || 0;
      const diff = l.usage_diff !== undefined ? l.usage_diff : l.usageDiff;
      if (diff != null && !Number.isNaN(Number(diff))) {
        totalUsageDiff += Number(diff);
      }
    }

    let avgRate: number | null = null;
    if (totalUsageDiff > 0) {
      if (odoUnit === "km") {
        avgRate = Number(((totalLiters / totalUsageDiff) * 100).toFixed(2));
      } else {
        avgRate = Number((totalLiters / totalUsageDiff).toFixed(2));
      }
    }

    let normDiff: number | null = null;
    let isOverNorm = false;

    if (avgRate !== null && fuelNorm !== null && fuelNorm > 0) {
      normDiff = Number((avgRate - fuelNorm).toFixed(2));
      isOverNorm = avgRate > fuelNorm;
    }

    return {
      vehicleId,
      code,
      name,
      plate,
      odoUnit,
      fuelNorm,
      totalLiters: Number(totalLiters.toFixed(2)),
      dispenseCount,
      totalUsageDiff: Number(totalUsageDiff.toFixed(2)),
      avgRate,
      normDiff,
      isOverNorm,
    };
  });
}

export interface ZoneIssueItemInput {
  product_name?: string;
  productName?: string;
  variant_label?: string;
  variantLabel?: string;
  unit?: string;
  quantity: number;
  unit_price?: number;
  unitPrice?: number;
  total_amount?: number;
  totalAmount?: number;
  [key: string]: unknown;
}

export interface ZoneIssueInput {
  id?: string;
  zone_id?: string | null;
  zoneId?: string | null;
  zone_name?: string | null;
  zoneName?: string | null;
  zones?: { name?: string } | null;
  zone?: { name?: string } | null;
  items?: ZoneIssueItemInput[];
  [key: string]: unknown;
}

export interface ZoneDefectInput {
  id?: string;
  zone_id?: string | null;
  zoneId?: string | null;
  [key: string]: unknown;
}

/**
 * Aggregates cost and item breakdown per zone.
 */
export function calculateZoneCosts(
  issuesWithItems: ZoneIssueInput[],
  defectNotesWithItems: ZoneDefectInput[] = []
): ZoneCostReportData {
  type ZoneAccumulator = {
    zoneId: string;
    zoneName: string;
    totalCost: number;
    issueCount: number;
    defectCount: number;
    itemsMap: Map<string, {
      productName: string;
      variantLabel: string;
      unit: string;
      quantity: number;
      totalAmount: number;
    }>;
  };

  const zonesMap = new Map<string, ZoneAccumulator>();

  const getOrCreateZone = (zoneId: string, initialName = ""): ZoneAccumulator => {
    let entry = zonesMap.get(zoneId);
    if (!entry) {
      entry = {
        zoneId,
        zoneName: initialName || zoneId,
        totalCost: 0,
        issueCount: 0,
        defectCount: 0,
        itemsMap: new Map(),
      };
      zonesMap.set(zoneId, entry);
    }
    if (initialName && (!entry.zoneName || entry.zoneName === zoneId)) {
      entry.zoneName = initialName;
    }
    return entry;
  };

  // Process defect notes
  for (const def of defectNotesWithItems) {
    const zoneId = def.zone_id || def.zoneId;
    if (!zoneId) continue;
    const entry = getOrCreateZone(zoneId);
    entry.defectCount += 1;
  }

  // Process issues
  for (const issue of issuesWithItems) {
    const zoneId = issue.zone_id || issue.zoneId;
    if (!zoneId) continue;

    const zoneName =
      issue.zone_name ||
      issue.zoneName ||
      issue.zones?.name ||
      issue.zone?.name ||
      "";

    const entry = getOrCreateZone(zoneId, zoneName);
    entry.issueCount += 1;

    const items = issue.items || [];
    for (const it of items) {
      const pName = it.product_name || it.productName || "Vật tư";
      const vLabel = it.variant_label || it.variantLabel || "";
      const unit = it.unit || "cái";
      const qty = Number(it.quantity) || 0;
      const uPrice =
        it.unit_price !== undefined
          ? Number(it.unit_price)
          : it.unitPrice !== undefined
            ? Number(it.unitPrice)
            : 0;

      const totalAmt =
        it.total_amount !== undefined
          ? Number(it.total_amount)
          : it.totalAmount !== undefined
            ? Number(it.totalAmount)
            : qty * uPrice;

      entry.totalCost += totalAmt;

      const itemKey = `${pName}::${vLabel}::${unit}`;
      const existing = entry.itemsMap.get(itemKey);
      if (existing) {
        existing.quantity += qty;
        existing.totalAmount += totalAmt;
      } else {
        entry.itemsMap.set(itemKey, {
          productName: pName,
          variantLabel: vLabel,
          unit,
          quantity: qty,
          totalAmount: totalAmt,
        });
      }
    }
  }

  const grandTotalCost = Array.from(zonesMap.values()).reduce(
    (sum, z) => sum + z.totalCost,
    0
  );

  const zones: ZoneCostRow[] = Array.from(zonesMap.values())
    .map((z) => {
      const percentage =
        grandTotalCost > 0
          ? Number(((z.totalCost / grandTotalCost) * 100).toFixed(2))
          : 0;

      const items = Array.from(z.itemsMap.values()).map((it) => ({
        productName: it.productName,
        variantLabel: it.variantLabel,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.quantity > 0 ? Math.round(it.totalAmount / it.quantity) : 0,
        totalAmount: it.totalAmount,
      }));

      // Sort items by totalAmount descending
      items.sort((a, b) => b.totalAmount - a.totalAmount);

      return {
        zoneId: z.zoneId,
        zoneName: z.zoneName,
        totalCost: z.totalCost,
        percentage,
        issueCount: z.issueCount,
        defectCount: z.defectCount,
        items,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost || a.zoneName.localeCompare(b.zoneName));

  return {
    grandTotalCost,
    zones,
  };
}

export interface StockCardRawEntryInput {
  id: string;
  created_at?: string;
  createdAt?: string;
  ref_type?: string | null;
  refType?: string | null;
  ref_code?: string | null;
  refCode?: string | null;
  movement_type?: string;
  movementType?: string;
  movement_label?: string;
  movementLabel?: string;
  notes?: string | null;
  actor_name?: string;
  actorName?: string;
  quantity: number;
  [key: string]: unknown;
}

/**
 * Calculates running balance and totals for stock card entries.
 */
export function calculateStockCardEntries(
  rawEntries: StockCardRawEntryInput[],
  openingStock: number
): {
  openingStock: number;
  totalIn: number;
  totalOut: number;
  closingStock: number;
  entries: StockCardEntry[];
} {
  // Sort chronological
  const sorted = [...rawEntries].sort((a, b) => {
    const tA = new Date(a.created_at || a.createdAt || "").getTime();
    const tB = new Date(b.created_at || b.createdAt || "").getTime();
    return tA - tB;
  });

  let runningBalance = openingStock;
  let totalIn = 0;
  let totalOut = 0;

  const entries: StockCardEntry[] = sorted.map((e) => {
    const mType = e.movement_type || e.movementType || "";
    const qty = Math.abs(Number(e.quantity) || 0);

    const isIn = isStockIn(mType);
    const inQty = isIn ? qty : 0;
    const outQty = !isIn ? qty : 0;

    totalIn += inQty;
    totalOut += outQty;
    runningBalance = runningBalance + inQty - outQty;

    const label =
      e.movement_label ||
      e.movementLabel ||
      MOVEMENT_TYPE[mType] ||
      mType;

    return {
      id: e.id,
      createdAt: e.created_at || e.createdAt || "",
      refType: e.ref_type ?? e.refType ?? null,
      refCode: e.ref_code ?? e.refCode ?? null,
      movementType: mType,
      movementLabel: label,
      notes: e.notes ?? null,
      actorName: e.actor_name || e.actorName || "—",
      inQty,
      outQty,
      runningBalance,
    };
  });

  return {
    openingStock,
    totalIn,
    totalOut,
    closingStock: runningBalance,
    entries,
  };
}

function formatYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calculates start (from) and end (to) dates in YYYY-MM-DD for a given preset.
 */
export function getDateRangeFromPreset(
  preset: DatePreset,
  baseDate: Date = new Date()
): { from: string; to: string } {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth(); // 0-11
  const date = baseDate.getDate();

  switch (preset) {
    case "today": {
      const todayStr = formatYmd(baseDate);
      return { from: todayStr, to: todayStr };
    }
    case "7days": {
      const fromD = new Date(year, month, date - 6);
      return { from: formatYmd(fromD), to: formatYmd(baseDate) };
    }
    case "this_month": {
      const fromD = new Date(year, month, 1);
      const toD = new Date(year, month + 1, 0);
      return { from: formatYmd(fromD), to: formatYmd(toD) };
    }
    case "last_month": {
      const fromD = new Date(year, month - 1, 1);
      const toD = new Date(year, month, 0);
      return { from: formatYmd(fromD), to: formatYmd(toD) };
    }
    case "this_quarter": {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      const fromD = new Date(year, quarterStartMonth, 1);
      const toD = new Date(year, quarterStartMonth + 3, 0);
      return { from: formatYmd(fromD), to: formatYmd(toD) };
    }
    case "this_year": {
      const fromD = new Date(year, 0, 1);
      const toD = new Date(year, 11, 31);
      return { from: formatYmd(fromD), to: formatYmd(toD) };
    }
    case "custom":
    default: {
      const fromD = new Date(year, month, 1);
      const toD = new Date(year, month + 1, 0);
      return { from: formatYmd(fromD), to: formatYmd(toD) };
    }
  }
}
