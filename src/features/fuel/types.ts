import type { FuelType, FuelReceipt, FuelDispense, FuelMovement } from "@/lib/types";

export type { FuelType, FuelReceipt, FuelDispense, FuelMovement };

export interface FuelOverviewStat {
  id: string;
  code: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  dispensedThisMonth: number;
  dispensedToday: number;
  receivedThisMonth: number;
  isLowStock: boolean;
}

export interface FuelOverviewData {
  fuelTypes: FuelOverviewStat[];
  totalReceiptAmount: number;
}

export interface FuelReportRow {
  id: string;
  code: string;
  quantity: number;
  usage_diff: number | null;
  consumption_rate: number | null;
  created_at: string;
  driver_name: string | null;
  vehicle: {
    id: string;
    code: string;
    name: string;
    odo_unit: "km" | "hours";
    fuel_norm: number | null;
  } | null;
  zone: {
    name: string;
  } | null;
  fuel_type: {
    name: string;
    code: string;
  } | null;
}
