import { REQUISITION_STATUS } from "@/lib/labels";
import { formatZoneLabel } from "@/lib/format-zone";
import { dayRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  calculateStockCardEntries,
  calculateStockLedger,
  calculateVehicleConsumption,
  calculateZoneCosts,
  parseDateBoundary,
  type FuelLogInput,
  type StockCardRawEntryInput,
  type VehicleInput,
  type ZoneDefectInput,
  type ZoneIssueInput,
} from "./lib/calculations";
import { buildManagementAlerts } from "./lib/management-insights";
import type {
  GeneralReportData,
  ManagementOverviewData,
  PartnersReportData,
  RequisitionReportItem,
  RequisitionReportRow,
  StockCardData,
  StockLedgerRow,
  VehicleReportData,
  ZoneCostReportData,
} from "./types";

/**
 * Normalizes input date strings into ISO format for PostgreSQL gte/lte queries.
 */
function getDateBounds(from: string, to: string): { gte: string; lte: string } {
  let gte: string;
  let lte: string;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  if (DATE_RE.test(from)) {
    gte = new Date(`${from}T00:00:00.000+07:00`).toISOString();
  } else {
    gte = new Date(from).toISOString();
  }

  if (DATE_RE.test(to)) {
    lte = new Date(`${to}T23:59:59.999+07:00`).toISOString();
  } else {
    lte = new Date(to).toISOString();
  }

  return { gte, lte };
}

/**
 * Fetches general report data: inventory valuation, stock ledger, category breakdown,
 * defect summary, fuel summary, and overall period metrics.
 */
export async function fetchGeneralReportData(params: {
  locationId?: string;
  from: string;
  to: string;
}): Promise<GeneralReportData> {
  const supabase = await createClient();
  const { locationId, from, to } = params;
  const { gte, lte } = getDateBounds(from, to);

  const isSpecificLocation = Boolean(locationId && locationId !== "all");

  const [
    variantsRes,
    balancesRes,
    movementsRes,
    receiptsRes,
    issuesRes,
    defectsRes,
    repairsRes,
    liquidationsRes,
    fuelReceiptsRes,
    fuelDispensesRes,
    fuelTypesRes,
  ] = await Promise.all([
    supabase
      .from("skus")
      .select(`
        id, price, min_stock, product_id,
        units(name, symbol),
        products(id, name, category_id, categories(id, name)),
        sku_attribute_values(
          text_value, numeric_value, boolean_value, legacy_text_value,
          attribute_definitions(name),
          units(symbol)
        )
      `),
    isSpecificLocation
      ? supabase.from("stock_balances").select("sku_id, quantity").eq("location_id", locationId!)
      : supabase.from("stock_balances").select("sku_id, quantity"),
    isSpecificLocation
      ? supabase
          .from("stock_movements")
          .select("id, sku_id, movement_type, quantity, created_at, from_location_id, to_location_id")
          .or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`)
      : supabase
          .from("stock_movements")
          .select("id, sku_id, movement_type, quantity, created_at, from_location_id, to_location_id"),
    supabase
      .from("receipts")
      .select("id, status, created_at, receipt_items(quantity, unit_cost)")
      .eq("status", "posted")
      .gte("created_at", gte)
      .lte("created_at", lte),
    supabase
      .from("issues")
      .select("id, status, destination_type, created_at, issue_items(quantity, unit_price, sku_id)")
      .eq("status", "posted")
      .gte("created_at", gte)
      .lte("created_at", lte),
    supabase
      .from("defect_notes")
      .select("id, status, created_at, defect_note_items(quantity, unit_cost)")
      .neq("status", "cancelled")
      .gte("created_at", gte)
      .lte("created_at", lte),
    supabase
      .from("repair_orders")
      .select("id, status, total_cost, repair_order_items(quantity, cost, outcome)")
      .neq("status", "cancelled")
      .gte("created_at", gte)
      .lte("created_at", lte),
    supabase
      .from("liquidation_notes")
      .select("id, status, liquidation_items(quantity, method, unit_value, proceeds)")
      .in("status", ["approved", "completed"])
      .gte("created_at", gte)
      .lte("created_at", lte),
    supabase
      .from("fuel_receipts")
      .select("id, quantity, unit_price, total_amount")
      .eq("status", "completed")
      .gte("created_at", gte)
      .lte("created_at", lte),
    supabase
      .from("fuel_dispenses")
      .select("id, quantity")
      .eq("status", "completed")
      .gte("created_at", gte)
      .lte("created_at", lte),
    supabase
      .from("fuel_types")
      .select("id, current_stock")
      .eq("is_active", true),
  ]);

  if (variantsRes.error) throw new Error(variantsRes.error.message);
  if (balancesRes.error) throw new Error(balancesRes.error.message);
  if (movementsRes.error) throw new Error(movementsRes.error.message);
  if (receiptsRes.error) throw new Error(receiptsRes.error.message);
  if (issuesRes.error) throw new Error(issuesRes.error.message);
  if (defectsRes.error) throw new Error(defectsRes.error.message);
  if (repairsRes.error) throw new Error(repairsRes.error.message);
  if (liquidationsRes.error) throw new Error(liquidationsRes.error.message);
  if (fuelReceiptsRes.error) throw new Error(fuelReceiptsRes.error.message);
  if (fuelDispensesRes.error) throw new Error(fuelDispensesRes.error.message);
  if (fuelTypesRes.error) throw new Error(fuelTypesRes.error.message);

  const variants = variantsRes.data ?? [];
  const variantPriceMap = new Map<string, number>();
  for (const v of variants) {
    variantPriceMap.set(v.id, Number(v.price) || 0);
  }

  // 1. Calculate Current Balances Map
  const currentBalances = new Map<string, number>();
  for (const v of variants) {
    currentBalances.set(v.id, 0);
  }
  for (const b of balancesRes.data ?? []) {
    const current = currentBalances.get(b.sku_id) ?? 0;
    currentBalances.set(b.sku_id, current + (b.quantity ?? 0));
  }

  // 2. Adjust movements for location transfers if filtering by a specific warehouse
  const rawMovements = movementsRes.data ?? [];
  const movements = rawMovements.map((m) => {
    let movementType = m.movement_type as string;
    if (isSpecificLocation && m.movement_type === "transfer") {
      if (m.from_location_id === locationId) {
        movementType = "transfer_out";
      } else if (m.to_location_id === locationId) {
        movementType = "transfer_in";
      }
    }
    return {
      sku_id: m.sku_id,
      movement_type: movementType,
      quantity: m.quantity,
      created_at: m.created_at,
    };
  });

  // 3. Stock Ledger calculations
  const ledgerCalcMap = calculateStockLedger(movements, currentBalances, from, to);

  const stockLedger: StockLedgerRow[] = variants.map((v) => {
    const calc = ledgerCalcMap.get(v.id) ?? {
      variantId: v.id,
      openingQty: 0,
      inQty: 0,
      outQty: 0,
      closingQty: 0,
      netChange: 0,
    };
    const unitPrice = Number(v.price) || 0;
    const closingValue = calc.closingQty * unitPrice;
    const categoryName = (v.products as { categories?: { name?: string } | null } | null)?.categories?.name || "Chưa phân loại";
    const unitObj = v.units as { name?: string; symbol?: string } | null;
    const unit = unitObj?.symbol || unitObj?.name || "—";
    const attrVals = ((v as unknown as { sku_attribute_values?: Array<{ text_value?: string | null; legacy_text_value?: string | null; numeric_value?: number | null; units?: { symbol?: string | null } | null }> }).sku_attribute_values ?? []).map((av) => {
      return av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null);
    }).filter(Boolean);
    const vLabel = attrVals.length > 0 ? attrVals.join(" · ") : (unit !== "—" ? unit : "Mặc định");

    return {
      variantId: v.id,
      productName: (v.products as { name?: string } | null)?.name || "—",
      variantLabel: vLabel,
      unit,
      categoryName,
      openingQty: calc.openingQty,
      inQty: calc.inQty,
      outQty: calc.outQty,
      closingQty: calc.closingQty,
      unitPrice,
      closingValue,
    };
  }).sort((a, b) => a.productName.localeCompare(b.productName, "vi") || a.variantLabel.localeCompare(b.variantLabel, "vi"));

  // 4. Total Inventory Value & Category Breakdown
  const totalInventoryValue = stockLedger.reduce(
    (sum, row) => sum + Math.max(0, row.closingValue),
    0
  );

  const categoryCostMap = new Map<string, number>();
  for (const row of stockLedger) {
    const current = categoryCostMap.get(row.categoryName) ?? 0;
    categoryCostMap.set(row.categoryName, current + Math.max(0, row.closingValue));
  }

  const categoryBreakdown = Array.from(categoryCostMap.entries())
    .map(([categoryName, cost]) => ({
      categoryName,
      cost,
      percentage: totalInventoryValue > 0 ? Number(((cost / totalInventoryValue) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.cost - a.cost || a.categoryName.localeCompare(b.categoryName, "vi"));

  // 5. Total Import Value
  let totalImportValue = 0;
  for (const receipt of receiptsRes.data ?? []) {
    for (const item of receipt.receipt_items ?? []) {
      totalImportValue += (item.quantity ?? 0) * (Number(item.unit_cost) || 0);
    }
  }

  // 6. Total Issued Cost & Sales Revenue
  let totalIssuedCost = 0;
  let totalSalesRevenue = 0;
  for (const issue of issuesRes.data ?? []) {
    for (const item of issue.issue_items ?? []) {
      const qty = item.quantity ?? 0;
      const unitPrice =
        item.unit_price !== null && item.unit_price !== undefined
          ? Number(item.unit_price)
          : variantPriceMap.get(item.sku_id) ?? 0;
      const amount = qty * unitPrice;

      if (issue.destination_type === "customer") {
        totalSalesRevenue += amount;
      } else {
        totalIssuedCost += amount;
      }
    }
  }

  // 7. Defects Summary
  let totalDefects = 0;
  for (const note of defectsRes.data ?? []) {
    for (const item of note.defect_note_items ?? []) {
      totalDefects += item.quantity ?? 0;
    }
  }

  let repairedCount = 0;
  let repairCost = 0;
  for (const repair of repairsRes.data ?? []) {
    if (repair.total_cost !== null && repair.total_cost !== undefined) {
      repairCost += Number(repair.total_cost);
    }
    for (const item of repair.repair_order_items ?? []) {
      if (item.outcome === "returned_to_stock") {
        repairedCount += item.quantity ?? 0;
      }
      if (repair.total_cost === null || repair.total_cost === undefined) {
        repairCost += Number(item.cost) || 0;
      }
    }
  }

  let liquidationRevenue = 0;
  for (const liq of liquidationsRes.data ?? []) {
    for (const item of liq.liquidation_items ?? []) {
      liquidationRevenue += Number(item.proceeds) || 0;
    }
  }

  // 8. Fuel Summary
  let totalImportedLiters = 0;
  let totalFuelReceiptAmount = 0;
  for (const r of fuelReceiptsRes.data ?? []) {
    totalImportedLiters += Number(r.quantity) || 0;
    totalFuelReceiptAmount += Number(r.total_amount) || (Number(r.quantity) || 0) * (Number(r.unit_price) || 0);
  }

  let totalDispensedLiters = 0;
  for (const d of fuelDispensesRes.data ?? []) {
    totalDispensedLiters += Number(d.quantity) || 0;
  }

  let currentTankStock = 0;
  for (const ft of fuelTypesRes.data ?? []) {
    currentTankStock += Number(ft.current_stock) || 0;
  }

  const avgFuelPricePerLiter = totalImportedLiters > 0 ? totalFuelReceiptAmount / totalImportedLiters : 0;
  const estimatedFuelCost = Math.round(totalDispensedLiters * avgFuelPricePerLiter);

  return {
    totalInventoryValue,
    totalImportValue,
    totalIssuedCost,
    totalSalesRevenue,
    stockLedger,
    categoryBreakdown,
    defectsSummary: {
      totalDefects,
      repairedCount,
      repairCost,
      liquidationRevenue,
    },
    fuelSummary: {
      totalImportedLiters: Number(totalImportedLiters.toFixed(2)),
      totalDispensedLiters: Number(totalDispensedLiters.toFixed(2)),
      currentTankStock: Number(currentTankStock.toFixed(2)),
      estimatedCost: estimatedFuelCost,
    },
  };
}

/**
 * Fetches zone cost report data: cost per zone, issue count, defect count, and item breakdown.
 */
export async function fetchZoneCostReportData(params: {
  from: string;
  to: string;
}): Promise<ZoneCostReportData> {
  const supabase = await createClient();
  const { from, to } = params;
  const { gte, lte } = getDateBounds(from, to);

  const [zonesRes, issuesRes, defectsRes] = await Promise.all([
    supabase.from("zones").select("id, name").order("name"),
    supabase
      .from("issues")
      .select(
        `
        id, zone_id, destination_type, status,
        zones(name),
        issue_items(
          quantity, unit_price, sku_id, sku_name_snapshot, uom_name_snapshot,
          skus(
            id, sku_code,
            units(name, symbol),
            products(name),
            sku_attribute_values(
              text_value, numeric_value, boolean_value, legacy_text_value,
              attribute_definitions(name),
              units(symbol)
            )
          )
        )
      `
      )
      .eq("destination_type", "zone")
      .eq("status", "posted")
      .gte("created_at", gte)
      .lte("created_at", lte),
    supabase
      .from("defect_notes")
      .select("id, status, created_at, reported_by, profiles!defect_notes_reported_by_fkey(zone_id)")
      .neq("status", "cancelled")
      .gte("created_at", gte)
      .lte("created_at", lte),
  ]);

  if (zonesRes.error) throw new Error(zonesRes.error.message);
  if (issuesRes.error) throw new Error(issuesRes.error.message);
  if (defectsRes.error) throw new Error(defectsRes.error.message);

  const mappedIssues: ZoneIssueInput[] = (issuesRes.data ?? []).map((issue) => {
    const zoneName = (issue.zones as { name?: string } | null)?.name || "";
    const items = (issue.issue_items ?? []).map((it) => {
      const v = it.skus as {
        units?: { name?: string | null; symbol?: string | null } | null;
        sku_attribute_values?: Array<{
          text_value?: string | null;
          legacy_text_value?: string | null;
          numeric_value?: number | null;
          units?: { symbol?: string | null } | null;
        }>;
        products?: { name?: string } | null;
      } | null;
      const unit = v?.units?.symbol || v?.units?.name || it.uom_name_snapshot || "cái";
      const attrVals = (v?.sku_attribute_values ?? [])
        .map(
          (av) =>
            av.text_value ||
            av.legacy_text_value ||
            (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null)
        )
        .filter(Boolean);
      const vLabel = attrVals.length > 0 ? attrVals.join(" · ") : "";
      const productName = v?.products?.name || it.sku_name_snapshot || "Vật tư";
      const quantity = Number(it.quantity) || 0;
      const unitPrice = Number(it.unit_price) || 0;
      const totalAmount = quantity * unitPrice;

      return {
        product_name: productName,
        variant_label: vLabel,
        unit,
        quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
      };
    });

    return {
      id: issue.id,
      zone_id: issue.zone_id,
      zone_name: zoneName,
      items,
    };
  });

  const mappedDefects: ZoneDefectInput[] = (defectsRes.data ?? []).map((d) => {
    const zoneId = (d.profiles as { zone_id?: string | null } | null)?.zone_id ?? null;
    return {
      id: d.id,
      zone_id: zoneId,
    };
  });

  return calculateZoneCosts(mappedIssues, mappedDefects);
}

/**
 * Fetches vehicle fuel usage report data and compares consumption against configured norms.
 */
export async function fetchVehicleReportData(params: {
  from: string;
  to: string;
}): Promise<VehicleReportData> {
  const supabase = await createClient();
  const { from, to } = params;
  const { gte, lte } = getDateBounds(from, to);

  const [vehiclesRes, logsRes] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, code, name, odo_unit, fuel_norm, is_active")
      .eq("is_active", true)
      .order("code"),
    supabase
      .from("fuel_dispenses")
      .select("id, vehicle_id, quantity, usage_diff, created_at, status")
      .eq("status", "completed")
      .gte("created_at", gte)
      .lte("created_at", lte),
  ]);

  if (vehiclesRes.error) throw new Error(vehiclesRes.error.message);
  if (logsRes.error) throw new Error(logsRes.error.message);

  const vehicles: VehicleInput[] = (vehiclesRes.data ?? []).map((v) => ({
    id: v.id,
    code: v.code,
    name: v.name,
    plate: v.name,
    odoUnit: (v.odo_unit as "km" | "hours") || "km",
    fuelNorm: v.fuel_norm !== null ? Number(v.fuel_norm) : null,
  }));

  const logs: FuelLogInput[] = (logsRes.data ?? []).map((l) => ({
    vehicle_id: l.vehicle_id,
    quantity: Number(l.quantity) || 0,
    usage_diff: l.usage_diff !== null ? Number(l.usage_diff) : null,
    created_at: l.created_at,
  }));

  const vehicleRows = calculateVehicleConsumption(logs, vehicles);
  const totalLitersAllVehicles = Number(
    vehicleRows.reduce((sum, v) => sum + v.totalLiters, 0).toFixed(2)
  );

  return {
    totalLitersAllVehicles,
    vehicles: vehicleRows,
  };
}

/**
 * Fetches partner report data: suppliers (receipts, values) and customers (issues, sales).
 */
export async function fetchPartnersReportData(params: {
  from: string;
  to: string;
}): Promise<PartnersReportData> {
  const supabase = await createClient();
  const { from, to } = params;
  const { gte, lte } = getDateBounds(from, to);

  const [suppliersRes, receiptsRes, customersRes, issuesRes] = await Promise.all([
    supabase.from("suppliers").select("id, name, phone").order("name"),
    supabase
      .from("receipts")
      .select("id, supplier_id, status, created_at, receipt_items(quantity, unit_cost)")
      .eq("status", "posted")
      .gte("created_at", gte)
      .lte("created_at", lte),
    supabase.from("customers").select("id, name, phone").order("name"),
    supabase
      .from("issues")
      .select("id, customer_id, destination_type, status, created_at, issue_items(quantity, unit_price)")
      .eq("destination_type", "customer")
      .eq("status", "posted")
      .gte("created_at", gte)
      .lte("created_at", lte),
  ]);

  if (suppliersRes.error) throw new Error(suppliersRes.error.message);
  if (receiptsRes.error) throw new Error(receiptsRes.error.message);
  if (customersRes.error) throw new Error(customersRes.error.message);
  if (issuesRes.error) throw new Error(issuesRes.error.message);

  // 1. Aggregate Suppliers
  type SupplierAcc = {
    supplierId: string;
    supplierName: string;
    phone: string | null;
    receiptCount: number;
    totalQuantity: number;
    totalAmount: number;
  };

  const supplierMap = new Map<string, SupplierAcc>();
  for (const s of suppliersRes.data ?? []) {
    supplierMap.set(s.id, {
      supplierId: s.id,
      supplierName: s.name,
      phone: s.phone ?? null,
      receiptCount: 0,
      totalQuantity: 0,
      totalAmount: 0,
    });
  }

  for (const r of receiptsRes.data ?? []) {
    const sId = r.supplier_id || "unknown";
    let entry = supplierMap.get(sId);
    if (!entry) {
      entry = {
        supplierId: sId,
        supplierName: "Nhà cung cấp khác",
        phone: null,
        receiptCount: 0,
        totalQuantity: 0,
        totalAmount: 0,
      };
      supplierMap.set(sId, entry);
    }
    entry.receiptCount += 1;
    for (const it of r.receipt_items ?? []) {
      const qty = it.quantity ?? 0;
      const unitCost = Number(it.unit_cost) || 0;
      entry.totalQuantity += qty;
      entry.totalAmount += qty * unitCost;
    }
  }

  const suppliers = Array.from(supplierMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount || a.supplierName.localeCompare(b.supplierName, "vi")
  );

  // 2. Aggregate Customers
  type CustomerAcc = {
    customerId: string;
    customerName: string;
    phone: string | null;
    issueCount: number;
    totalQuantity: number;
    totalRevenue: number;
  };

  const customerMap = new Map<string, CustomerAcc>();
  for (const c of customersRes.data ?? []) {
    customerMap.set(c.id, {
      customerId: c.id,
      customerName: c.name,
      phone: c.phone ?? null,
      issueCount: 0,
      totalQuantity: 0,
      totalRevenue: 0,
    });
  }

  for (const i of issuesRes.data ?? []) {
    const cId = i.customer_id || "unknown";
    let entry = customerMap.get(cId);
    if (!entry) {
      entry = {
        customerId: cId,
        customerName: "Khách hàng vãng lai",
        phone: null,
        issueCount: 0,
        totalQuantity: 0,
        totalRevenue: 0,
      };
      customerMap.set(cId, entry);
    }
    entry.issueCount += 1;
    for (const it of i.issue_items ?? []) {
      const qty = it.quantity ?? 0;
      const unitPrice = Number(it.unit_price) || 0;
      entry.totalQuantity += qty;
      entry.totalRevenue += qty * unitPrice;
    }
  }

  const customers = Array.from(customerMap.values()).sort(
    (a, b) => b.totalRevenue - a.totalRevenue || a.customerName.localeCompare(b.customerName, "vi")
  );

  return {
    suppliers,
    customers,
  };
}

/**
 * Fetches stock card (thẻ kho) data for a single variant over a date range.
 */
export async function fetchStockCardData(params: {
  variantId: string;
  locationId?: string;
  from: string;
  to: string;
}): Promise<StockCardData> {
  const supabase = await createClient();
  const { variantId, locationId, from, to } = params;
  const isSpecificLocation = Boolean(locationId && locationId !== "all");

  const [variantRes, locationRes, balancesRes, movementsRes, profilesRes] = await Promise.all([
    supabase
      .from("skus")
      .select(`
        id, sku_code,
        units(name, symbol),
        products(name),
        sku_attribute_values(
          text_value, numeric_value, boolean_value, legacy_text_value,
          attribute_definitions(name),
          units(symbol)
        )
      `)
      .eq("id", variantId)
      .maybeSingle(),
    isSpecificLocation
      ? supabase.from("stock_locations").select("id, name").eq("id", locationId!).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    isSpecificLocation
      ? supabase.from("stock_balances").select("quantity").eq("sku_id", variantId).eq("location_id", locationId!)
      : supabase.from("stock_balances").select("quantity").eq("sku_id", variantId),
    isSpecificLocation
      ? supabase
          .from("stock_movements")
          .select(
            "id, sku_id, movement_type, quantity, ref_type, ref_id, notes, created_by, created_at, from_location_id, to_location_id"
          )
          .eq("sku_id", variantId)
          .or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`)
          .order("created_at", { ascending: true })
      : supabase
          .from("stock_movements")
          .select(
            "id, sku_id, movement_type, quantity, ref_type, ref_id, notes, created_by, created_at, from_location_id, to_location_id"
          )
          .eq("sku_id", variantId)
          .order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, name"),
  ]);

  if (variantRes.error) throw new Error(variantRes.error.message);
  if (!variantRes.data) throw new Error("Không tìm thấy thông tin biến thể vật tư");
  if (locationRes.error) throw new Error(locationRes.error.message);
  if (balancesRes.error) throw new Error(balancesRes.error.message);
  if (movementsRes.error) throw new Error(movementsRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const variant = variantRes.data;
  const productName = (variant.products as { name?: string } | null)?.name || "—";
  const unitObj = variant.units as { name?: string; symbol?: string } | null;
  const unit = unitObj?.symbol || unitObj?.name || "—";
  const attrVals = ((variant as unknown as { sku_attribute_values?: Array<{ text_value?: string | null; legacy_text_value?: string | null; numeric_value?: number | null; units?: { symbol?: string | null } | null }> }).sku_attribute_values ?? []).map((av) => {
    return av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null);
  }).filter(Boolean);
  const vLabel = attrVals.length > 0 ? attrVals.join(" · ") : (unit !== "—" ? unit : "Mặc định");
  const locationName = locationRes.data?.name || "Tất cả kho";

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.name]));

  // Current balance
  const currentBalance = (balancesRes.data ?? []).reduce(
    (sum, row) => sum + (row.quantity ?? 0),
    0
  );

  // Map all movements for stock ledger opening stock calculation
  const mappedAllMovements = (movementsRes.data ?? []).map((m) => {
    let mType = m.movement_type as string;
    if (isSpecificLocation && m.movement_type === "transfer") {
      if (m.from_location_id === locationId) {
        mType = "transfer_out";
      } else if (m.to_location_id === locationId) {
        mType = "transfer_in";
      }
    }
    return {
      ...m,
      movement_type: mType,
    };
  });

  const ledgerMap = calculateStockLedger(
    mappedAllMovements,
    new Map([[variantId, currentBalance]]),
    from,
    to
  );
  const openingStock = ledgerMap.get(variantId)?.openingQty ?? 0;

  // Filter movements within period
  const fromTime = parseDateBoundary(from, false);
  const toTime = parseDateBoundary(to, true);
  const periodMovements = mappedAllMovements.filter((m) => {
    const t = new Date(m.created_at).getTime();
    return t >= fromTime && t <= toTime;
  });

  // Batch lookup referenced codes
  const refIdsByType = new Map<string, Set<string>>();
  for (const m of periodMovements) {
    if (m.ref_type && m.ref_id) {
      let set = refIdsByType.get(m.ref_type);
      if (!set) {
        set = new Set();
        refIdsByType.set(m.ref_type, set);
      }
      set.add(m.ref_id);
    }
  }

  const refCodeMap = new Map<string, string>();

  const lookupPromises: Promise<void>[] = [];
  for (const [refType, idSet] of refIdsByType.entries()) {
    const ids = Array.from(idSet);
    if (ids.length === 0) continue;

    if (refType === "receipt") {
      lookupPromises.push(
        (async () => {
          const { data } = await supabase.from("receipts").select("id, code").in("id", ids);
          for (const r of data ?? []) refCodeMap.set(r.id, r.code);
        })()
      );
    } else if (refType === "issue") {
      lookupPromises.push(
        (async () => {
          const { data } = await supabase.from("issues").select("id, code").in("id", ids);
          for (const r of data ?? []) refCodeMap.set(r.id, r.code);
        })()
      );
    } else if (refType === "requisition") {
      lookupPromises.push(
        (async () => {
          const { data } = await supabase.from("requisitions").select("id, code").in("id", ids);
          for (const r of data ?? []) refCodeMap.set(r.id, r.code);
        })()
      );
    } else if (refType === "defect") {
      lookupPromises.push(
        (async () => {
          const { data } = await supabase.from("defect_notes").select("id, code").in("id", ids);
          for (const r of data ?? []) refCodeMap.set(r.id, r.code);
        })()
      );
    } else if (refType === "repair") {
      lookupPromises.push(
        (async () => {
          const { data } = await supabase.from("repair_orders").select("id, code").in("id", ids);
          for (const r of data ?? []) refCodeMap.set(r.id, r.code);
        })()
      );
    } else if (refType === "liquidation") {
      lookupPromises.push(
        (async () => {
          const { data } = await supabase.from("liquidation_notes").select("id, code").in("id", ids);
          for (const r of data ?? []) refCodeMap.set(r.id, r.code);
        })()
      );
    } else if (refType === "tool_borrowing" || refType === "tool") {
      lookupPromises.push(
        (async () => {
          const { data } = await supabase.from("tool_borrowings").select("id, code").in("id", ids);
          for (const r of data ?? []) refCodeMap.set(r.id, r.code);
        })()
      );
    } else if (refType === "exchange") {
      lookupPromises.push(
        (async () => {
          const { data } = await supabase.from("exchange_notes").select("id, code").in("id", ids);
          for (const r of data ?? []) refCodeMap.set(r.id, r.code);
        })()
      );
    }
  }

  await Promise.all(lookupPromises);

  const rawEntries: StockCardRawEntryInput[] = periodMovements.map((m) => ({
    id: m.id,
    created_at: m.created_at,
    ref_type: m.ref_type,
    ref_code: m.ref_id ? refCodeMap.get(m.ref_id) ?? null : null,
    movement_type: m.movement_type,
    notes: m.notes,
    actor_name: m.created_by ? profileMap.get(m.created_by) ?? "—" : "—",
    quantity: m.quantity,
  }));

  const calculated = calculateStockCardEntries(rawEntries, openingStock);

  return {
    variantId,
    productName,
    variantLabel: vLabel,
    unit,
    locationName,
    openingStock: calculated.openingStock,
    totalIn: calculated.totalIn,
    totalOut: calculated.totalOut,
    closingStock: calculated.closingStock,
    entries: calculated.entries,
  };
}

/**
 * 6. Fetches Requisitions Report Data filtered by status, zone, keyword, and date range.
 */
export async function fetchRequisitionsReportData(params: {
  status?: string | null;
  zoneId?: string | null;
  q?: string | null;
  from?: string | null;
  to?: string | null;
}): Promise<RequisitionReportRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("requisitions")
    .select(
      `
      id,
      code,
      purpose,
      status,
      requisition_type,
      created_at,
      requester:profiles!requisitions_requester_id_fkey(name),
      zone:zones!requisitions_zone_id_fkey(name),
      sub_zone:sub_zones!requisitions_sub_zone_id_fkey(name),
      items:requisition_items(
        quantity,
        skus(
          id,
          sku_code,
          units(name, symbol),
          products(name),
          sku_attribute_values(
            text_value,
            numeric_value,
            legacy_text_value,
            units(symbol)
          )
        )
      )
    `
    )
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status as never);
  }
  if (params.zoneId && params.zoneId !== "all") {
    query = query.eq("zone_id", params.zoneId);
  }
  if (params.q) {
    query = query.or(`code.ilike.%${params.q}%,purpose.ilike.%${params.q}%`);
  }
  const { gte, lte } = dayRange(params.from ?? null, params.to ?? null);
  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);

  const { data, error } = await query;
  if (error) {
    console.error("fetchRequisitionsReportData error:", error);
    throw new Error(error.message);
  }

  interface RawRequisitionQueryResult {
    id: string;
    code: string;
    purpose: string;
    status: string;
    requisition_type: string;
    created_at: string;
    requester?: { name?: string } | null;
    zone?: { name?: string } | null;
    sub_zone?: { name?: string } | null;
    items?: Array<{
      quantity: number;
      skus?: {
        id?: string;
        sku_code?: string | null;
        units?: { name?: string | null; symbol?: string | null } | null;
        products?: { name: string } | null;
        sku_attribute_values?: Array<{
          text_value?: string | null;
          legacy_text_value?: string | null;
          numeric_value?: number | null;
          units?: { symbol?: string | null } | null;
        }> | null;
      } | null;
      variants?: {
        id?: string;
        sku_code?: string | null;
        units?: { name?: string | null; symbol?: string | null } | null;
        products?: { name: string } | null;
        sku_attribute_values?: Array<{
          text_value?: string | null;
          legacy_text_value?: string | null;
          numeric_value?: number | null;
          units?: { symbol?: string | null } | null;
        }> | null;
      } | null;
    }> | null;
  }

  return ((data ?? []) as unknown as RawRequisitionQueryResult[]).map((r) => {
    const rawItems = r.items ?? [];

    const items: RequisitionReportItem[] = rawItems.map((it) => {
      const v = it.skus || it.variants;
      const unitObj = v?.units;
      const unit = unitObj?.symbol || unitObj?.name || "—";
      const attrVals = (v?.sku_attribute_values ?? []).map(av => av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null)).filter(Boolean);
      const vLabel = attrVals.length > 0 ? attrVals.join(" · ") : (unit !== "—" ? unit : "");
      return {
        productName: v?.products?.name || "Vật tư",
        variantLabel: vLabel,
        unit,
        quantity: it.quantity,
      };
    });

    return {
      id: r.id,
      code: r.code,
      createdAt: r.created_at,
      requesterName: (r.requester as { name?: string } | null)?.name || "—",
      zoneName: formatZoneLabel((r.zone as { name?: string } | null)?.name, (r.sub_zone as { name?: string } | null)?.name),
      purpose: r.purpose,
      requisitionType: r.requisition_type,
      status: r.status,
      statusLabel: REQUISITION_STATUS[r.status] || r.status,
      items,
    };
  });
}

/** Aggregates the native management landing view without changing detail report contracts. */
export async function fetchManagementOverviewData(params: {
  locationId?: string;
  from: string;
  to: string;
}): Promise<ManagementOverviewData> {
  const [generalResult, zonesResult, vehiclesResult] = await Promise.allSettled([
    fetchGeneralReportData(params),
    fetchZoneCostReportData({ from: params.from, to: params.to }),
    fetchVehicleReportData({ from: params.from, to: params.to }),
  ]);

  const general: GeneralReportData =
    generalResult.status === "fulfilled"
      ? generalResult.value
      : {
          totalInventoryValue: 0,
          totalImportValue: 0,
          totalIssuedCost: 0,
          totalSalesRevenue: 0,
          stockLedger: [],
          categoryBreakdown: [],
          defectsSummary: {
            totalDefects: 0,
            repairedCount: 0,
            repairCost: 0,
            liquidationRevenue: 0,
          },
          fuelSummary: {
            totalImportedLiters: 0,
            totalDispensedLiters: 0,
            currentTankStock: 0,
            estimatedCost: 0,
          },
        };

  const zones: ZoneCostReportData =
    zonesResult.status === "fulfilled"
      ? zonesResult.value
      : { grandTotalCost: 0, zones: [] };

  const vehicles: VehicleReportData =
    vehiclesResult.status === "fulfilled"
      ? vehiclesResult.value
      : { totalLitersAllVehicles: 0, vehicles: [] };

  return {
    general,
    zones,
    vehicles,
    alerts: buildManagementAlerts({ general, zones, vehicles }),
    generatedAt: new Date().toISOString(),
  };
}
