export type DatePreset =
  | "today"
  | "yesterday"
  | "7days"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export interface ReportDateRange {
  from: string; // ISO string or YYYY-MM-DD
  to: string; // ISO string or YYYY-MM-DD
  preset: DatePreset;
}

export interface StockLedgerRow {
  variantId: string;
  productName: string;
  variantLabel: string;
  unit: string;
  categoryName: string;
  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;
  unitPrice: number;
  closingValue: number;
}

export interface StockLedgerCalculation {
  variantId: string;
  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;
  netChange: number;
}

export interface GeneralReportData {
  totalInventoryValue: number;
  totalImportValue: number;
  totalIssuedCost: number;
  totalSalesRevenue: number;
  stockLedger: StockLedgerRow[];
  categoryBreakdown: { categoryName: string; cost: number; percentage: number }[];
  defectsSummary: {
    totalDefects: number;
    repairedCount: number;
    repairCost: number;
    liquidationRevenue: number;
  };
  fuelSummary: {
    totalImportedLiters: number;
    totalDispensedLiters: number;
    currentTankStock: number;
    estimatedCost: number;
  };
}

export interface ZoneCostItem {
  productName: string;
  variantLabel: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface ZoneCostRow {
  zoneId: string;
  zoneName: string;
  totalCost: number;
  percentage: number;
  issueCount: number;
  defectCount: number;
  items: ZoneCostItem[];
}

export interface ZoneCostReportData {
  grandTotalCost: number;
  zones: ZoneCostRow[];
}

export interface VehicleUsageRow {
  vehicleId: string;
  code: string;
  name: string;
  plate: string | null;
  odoUnit: "km" | "hours";
  fuelNorm: number | null;
  totalLiters: number;
  dispenseCount: number;
  totalUsageDiff: number;
  avgRate: number | null;
  normDiff: number | null;
  isOverNorm: boolean;
}

export interface VehicleReportData {
  totalLitersAllVehicles: number;
  vehicles: VehicleUsageRow[];
}

export interface SupplierReportRow {
  supplierId: string;
  supplierName: string;
  phone: string | null;
  receiptCount: number;
  totalQuantity: number;
  totalAmount: number;
}

export interface CustomerReportRow {
  customerId: string;
  customerName: string;
  phone: string | null;
  issueCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface PartnersReportData {
  suppliers: SupplierReportRow[];
  customers: CustomerReportRow[];
}

export interface StockCardEntry {
  id: string;
  createdAt: string;
  refType: string | null;
  refCode: string | null;
  movementType: string;
  movementLabel: string;
  notes: string | null;
  actorName: string;
  inQty: number;
  outQty: number;
  runningBalance: number;
}

export interface StockCardData {
  variantId: string;
  productName: string;
  variantLabel: string;
  unit: string;
  locationName: string;
  openingStock: number;
  totalIn: number;
  totalOut: number;
  closingStock: number;
  entries: StockCardEntry[];
}
