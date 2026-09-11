"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { dayRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { fuelReceiptSchema, fuelDispenseSchema, type FuelReceiptInput, type FuelDispenseInput } from "./schema";
import type { FuelOverviewData, FuelReportRow } from "./types";

// ─── Fuel Types ───

export async function getFuelTypes(opts?: { activeOnly?: boolean }) {
  const supabase = await createClient();
  let query = supabase
    .from("fuel_types")
    .select("*")
    .order("name");
  if (opts?.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Fuel Receipts ───

export async function getFuelReceipts(opts?: {
  fuelTypeId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  const page = Math.max(1, Number(opts?.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(opts?.pageSize ?? 20) || 20));

  let query = supabase
    .from("fuel_receipts")
    .select(
      "*, fuel_type:fuel_types(name,code,unit), supplier:suppliers(name), receiver:profiles!fuel_receipts_received_by_fkey(name)",
      { count: "exact" }
    )
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (opts?.fuelTypeId && opts.fuelTypeId !== "all") {
    query = query.eq("fuel_type_id", opts.fuelTypeId);
  }
  if (opts?.q && opts.q.trim()) {
    const term = opts.q.trim();
    query = query.or(`code.ilike.%${term}%,invoice_number.ilike.%${term}%`);
  }
  const { gte, lte } = dayRange(opts?.from ?? null, opts?.to ?? null);
  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: data ?? [], total: count ?? 0 };
}

export async function createFuelReceiptAction(input: FuelReceiptInput) {
  const profile = await requireManager();
  const parsed = fuelReceiptSchema.parse(input);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_fuel_receipt", {
    p_supplier_id: (parsed.supplierId ?? null) as unknown as string,
    p_fuel_type_id: parsed.fuelTypeId,
    p_quantity: parsed.quantity,
    p_unit_price: parsed.unitPrice,
    p_invoice_number: (parsed.invoiceNumber ?? null) as unknown as string,
    p_invoice_images: parsed.invoiceImages ?? [],
    p_notes: (parsed.notes ?? null) as unknown as string,
    p_by: profile.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/fuel");
  return data as string;
}

export async function cancelFuelReceiptAction(id: string) {
  const profile = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_fuel_receipt", {
    p_id: id,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/fuel");
}

// ─── Fuel Dispenses ───

export async function getFuelDispenses(opts?: {
  vehicleId?: string;
  zoneId?: string;
  fuelTypeId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  const page = Math.max(1, Number(opts?.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(opts?.pageSize ?? 20) || 20));

  let query = supabase
    .from("fuel_dispenses")
    .select(
      "*, fuel_type:fuel_types(name,code,unit), vehicle:vehicles(code,name,odo_unit), zone:zones(name), sub_zone:sub_zones(name), dispenser:profiles!fuel_dispenses_dispenser_id_fkey(name)",
      { count: "exact" }
    )
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (opts?.vehicleId && opts.vehicleId !== "all") query = query.eq("vehicle_id", opts.vehicleId);
  if (opts?.zoneId && opts.zoneId !== "all") query = query.eq("zone_id", opts.zoneId);
  if (opts?.fuelTypeId && opts.fuelTypeId !== "all") query = query.eq("fuel_type_id", opts.fuelTypeId);
  if (opts?.q && opts.q.trim()) {
    const term = opts.q.trim();
    query = query.or(`code.ilike.%${term}%,driver_name.ilike.%${term}%`);
  }
  const { gte, lte } = dayRange(opts?.from ?? null, opts?.to ?? null);
  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: data ?? [], total: count ?? 0 };
}

export async function createFuelDispenseAction(input: FuelDispenseInput) {
  const profile = await requireProfile();
  const parsed = fuelDispenseSchema.parse(input);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_fuel_dispense", {
    p_vehicle_id: (parsed.vehicleId ?? null) as unknown as string,
    p_zone_id: (parsed.zoneId ?? null) as unknown as string,
    p_fuel_type_id: parsed.fuelTypeId,
    p_quantity: parsed.quantity,
    p_current_odo: (parsed.currentOdo ?? null) as unknown as number,
    p_driver_name: (parsed.driverName ?? null) as unknown as string,
    p_meter_images: parsed.meterImages ?? [],
    p_notes: (parsed.notes ?? null) as unknown as string,
    p_by: profile.id,
    p_sub_zone_id: (parsed.subZoneId ?? null) as unknown as string,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/fuel");
  return data as string;
}

export async function cancelFuelDispenseAction(id: string) {
  const profile = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_fuel_dispense", {
    p_id: id,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/fuel");
}

// ─── Vehicle QR Lookup ───

export async function getVehicleByQrAction(qrText: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vehicle_by_qr", {
    p_qr_text: qrText,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ─── Fuel Overview (Dashboard Stats) ───

export async function getFuelOverview(): Promise<FuelOverviewData> {
  const supabase = await createClient();

  // Tính ngày bắt đầu tháng và ngày hiện tại theo múi giờ VN (+07:00)
  const now = new Date();
  const vnYear = now.getFullYear();
  const vnMonth = String(now.getMonth() + 1).padStart(2, "0");
  const vnDay = String(now.getDate()).padStart(2, "0");

  const startOfMonthIso = new Date(`${vnYear}-${vnMonth}-01T00:00:00+07:00`).toISOString();
  const startOfDayIso = new Date(`${vnYear}-${vnMonth}-${vnDay}T00:00:00+07:00`).toISOString();

  const [fuelTypesRes, monthDispensesRes, monthReceiptsRes, todayDispensesRes] = await Promise.all([
    supabase
      .from("fuel_types")
      .select("id, code, name, unit, current_stock, min_stock")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("fuel_dispenses")
      .select("fuel_type_id, quantity")
      .eq("status", "completed")
      .gte("created_at", startOfMonthIso),
    supabase
      .from("fuel_receipts")
      .select("fuel_type_id, quantity, total_amount")
      .eq("status", "completed")
      .gte("created_at", startOfMonthIso),
    supabase
      .from("fuel_dispenses")
      .select("fuel_type_id, quantity")
      .eq("status", "completed")
      .gte("created_at", startOfDayIso),
  ]);

  if (fuelTypesRes.error) throw new Error(fuelTypesRes.error.message);
  if (monthDispensesRes.error) throw new Error(monthDispensesRes.error.message);
  if (monthReceiptsRes.error) throw new Error(monthReceiptsRes.error.message);
  if (todayDispensesRes.error) throw new Error(todayDispensesRes.error.message);

  const fuelTypes = fuelTypesRes.data ?? [];
  const monthDispenses = monthDispensesRes.data ?? [];
  const monthReceipts = monthReceiptsRes.data ?? [];
  const todayDispenses = todayDispensesRes.data ?? [];

  const dispensedThisMonth: Record<string, number> = {};
  const dispensedToday: Record<string, number> = {};
  const receivedThisMonth: Record<string, number> = {};
  let totalReceiptAmount = 0;

  for (const d of monthDispenses) {
    dispensedThisMonth[d.fuel_type_id] = (dispensedThisMonth[d.fuel_type_id] ?? 0) + Number(d.quantity);
  }
  for (const d of todayDispenses) {
    dispensedToday[d.fuel_type_id] = (dispensedToday[d.fuel_type_id] ?? 0) + Number(d.quantity);
  }
  for (const r of monthReceipts) {
    receivedThisMonth[r.fuel_type_id] = (receivedThisMonth[r.fuel_type_id] ?? 0) + Number(r.quantity);
    totalReceiptAmount += Number(r.total_amount);
  }

  return {
    fuelTypes: fuelTypes.map((ft) => ({
      id: ft.id,
      code: ft.code,
      name: ft.name,
      unit: ft.unit,
      current_stock: Number(ft.current_stock),
      min_stock: Number(ft.min_stock),
      dispensedThisMonth: dispensedThisMonth[ft.id] ?? 0,
      dispensedToday: dispensedToday[ft.id] ?? 0,
      receivedThisMonth: receivedThisMonth[ft.id] ?? 0,
      isLowStock: Number(ft.current_stock) <= Number(ft.min_stock),
    })),
    totalReceiptAmount,
  };
}

// ─── Fuel Reports Data ───

export async function getFuelReportData(opts: {
  from?: string;
  to?: string;
  vehicleId?: string;
  zoneId?: string;
  fuelTypeId?: string;
}): Promise<FuelReportRow[]> {
  const supabase = await createClient();
  const { gte, lte } = dayRange(opts?.from ?? null, opts?.to ?? null);

  let query = supabase
    .from("fuel_dispenses")
    .select(
      "id, code, quantity, usage_diff, consumption_rate, created_at, driver_name, vehicle:vehicles(id,code,name,odo_unit,fuel_norm), zone:zones(name), fuel_type:fuel_types(name,code)"
    )
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);
  if (opts?.vehicleId && opts.vehicleId !== "all") query = query.eq("vehicle_id", opts.vehicleId);
  if (opts?.zoneId && opts.zoneId !== "all") query = query.eq("zone_id", opts.zoneId);
  if (opts?.fuelTypeId && opts.fuelTypeId !== "all") query = query.eq("fuel_type_id", opts.fuelTypeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FuelReportRow[];
}
