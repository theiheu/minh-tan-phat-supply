"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { dayRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { dispatchBusinessEvent } from "@/features/notifications/server/dispatch-business-event";
import {
  fuelReceiptSchema,
  fuelDispenseSchema,
  fuelTypeSchema,
  fuelTypeUpdateSchema,
  type FuelReceiptInput,
  type FuelDispenseInput,
  type FuelTypeInput,
  type FuelTypeUpdateInput,
} from "./schema";
import type { FuelOverviewData, FuelReportRow } from "./types";

export async function getActiveDriverAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username, email")
    .eq("role", "driver")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fuelReceiptMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("fuel_receipts")
      .select("code, supplier:suppliers(name), fuel_type:fuel_types(name)")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

async function fuelDispenseMeta(id: string) {
  try {
    const supabase = await createClient();
    if (!supabase.from) return null;
    const { data } = await supabase
      .from("fuel_dispenses")
      .select("code, driver_name, driver_id, vehicle:vehicles(name, code), zone:zones(name), fuel_type:fuel_types(name)")
      .eq("id", id)
      .single();
    return data;
  } catch {
    return null;
  }
}

// ─── Fuel Types ───

export async function getFuelTypes(opts?: { activeOnly?: boolean; q?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("fuel_types")
    .select("*")
    .order("name");
  if (opts?.activeOnly) query = query.eq("is_active", true);
  if (opts?.q && opts.q.trim()) {
    const term = opts.q.trim();
    query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%,description.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getFuelTypeById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fuel_types")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createFuelTypeAction(input: FuelTypeInput) {
  const profile = await requireManager();
  const parsed = fuelTypeSchema.parse(input);

  const supabase = await createClient();

  // Kiểm tra trùng mã (case-insensitive)
  const { data: existing } = await supabase
    .from("fuel_types")
    .select("id, code")
    .ilike("code", parsed.code)
    .maybeSingle();

  if (existing) {
    throw new Error(`Mã loại nhiên liệu "${parsed.code}" đã tồn tại. Vui lòng chọn mã khác.`);
  }

  const initialStock = Number(parsed.initialStock ?? 0);

  const { data, error } = await supabase
    .from("fuel_types")
    .insert({
      code: parsed.code,
      name: parsed.name,
      unit: parsed.unit,
      min_stock: parsed.minStock,
      current_stock: initialStock,
      description: parsed.description ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Nếu có khai báo tồn ban đầu > 0, tạo bút toán sổ cái biến động
  if (initialStock > 0 && data?.id) {
    try {
      await supabase.from("fuel_movements").insert({
        fuel_type_id: data.id,
        movement_type: "adjustment_in",
        quantity: initialStock,
        balance_after: initialStock,
        ref_type: "fuel_types",
        ref_id: data.id,
        notes: "Khai báo tồn kho đầu kỳ khi tạo loại",
        created_by: profile.id,
      });
    } catch (movementErr) {
      console.warn("Lỗi ghi sổ cái tồn đầu kỳ nhiên liệu:", movementErr);
    }
  }

  revalidatePath("/fuel");
  revalidatePath("/admin/vehicles");
  return data;
}

export async function updateFuelTypeAction(id: string, input: FuelTypeUpdateInput) {
  await requireManager();
  const parsed = fuelTypeUpdateSchema.parse(input);

  const supabase = await createClient();

  // Kiểm tra trùng mã với bản ghi khác
  const { data: existing } = await supabase
    .from("fuel_types")
    .select("id, code")
    .ilike("code", parsed.code)
    .neq("id", id)
    .maybeSingle();

  if (existing) {
    throw new Error(`Mã loại nhiên liệu "${parsed.code}" đã được sử dụng bởi loại khác.`);
  }

  const { data, error } = await supabase
    .from("fuel_types")
    .update({
      code: parsed.code,
      name: parsed.name,
      unit: parsed.unit,
      min_stock: parsed.minStock,
      description: parsed.description ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/fuel");
  revalidatePath("/admin/vehicles");
  return data;
}

export async function toggleFuelTypeActiveAction(id: string, isActive: boolean) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("fuel_types")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/fuel");
  revalidatePath("/admin/vehicles");
}

export async function deleteFuelTypeAction(id: string) {
  await requireManager();
  const supabase = await createClient();

  // Kiểm tra ràng buộc dữ liệu
  const [dispensesCount, receiptsCount, vehiclesCount] = await Promise.all([
    supabase.from("fuel_dispenses").select("id", { count: "exact", head: true }).eq("fuel_type_id", id),
    supabase.from("fuel_receipts").select("id", { count: "exact", head: true }).eq("fuel_type_id", id),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("fuel_type_id", id),
  ]);

  const hasDispenses = (dispensesCount.count ?? 0) > 0;
  const hasReceipts = (receiptsCount.count ?? 0) > 0;
  const hasVehicles = (vehiclesCount.count ?? 0) > 0;

  if (hasDispenses || hasReceipts || hasVehicles) {
    const reasons: string[] = [];
    if (hasReceipts) reasons.push("phiếu nhập kho");
    if (hasDispenses) reasons.push("phiếu cấp phát");
    if (hasVehicles) reasons.push("phương tiện đang liên kết");
    throw new Error(
      `Không thể xóa loại nhiên liệu này vì đã phát sinh ${reasons.join(", ")}. Bạn có thể chọn ngưng sử dụng (tắt hoạt động) để ẩn khỏi danh sách lựa chọn.`
    );
  }

  // Xóa các bút toán khởi tạo tồn (nếu có)
  await supabase.from("fuel_movements").delete().eq("fuel_type_id", id);

  const { error } = await supabase.from("fuel_types").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/fuel");
  revalidatePath("/admin/vehicles");
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

  const receiptId = data as string;
  let code = "PNNL";
  let supplierName: string | undefined;
  let meta: any = null;
  if (receiptId) {
    meta = await fuelReceiptMeta(receiptId);
    if (meta?.code) code = meta.code;
    supplierName = (meta?.supplier as { name?: string } | null)?.name;
  }

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "fuel.receipt_completed",
      actorId: profile.id,
      subject: { type: "fuel_receipt", id: receiptId },
      payload: {
        code,
        fuelTypeName: (meta?.fuel_type as { name?: string } | null)?.name ?? "Nhiên liệu",
        quantity: parsed.quantity,
        unit: "Lít",
        supplierName,
        totalAmount: parsed.quantity * parsed.unitPrice,
        notes: parsed.notes,
      },
    },
  });

  revalidatePath("/fuel");
  return data as string;
}

export async function cancelFuelReceiptAction(id: string) {
  const profile = await requireManager();
  const supabase = await createClient();

  const meta = await fuelReceiptMeta(id);
  const code = meta?.code ?? "PNNL";

  const { error } = await supabase.rpc("cancel_fuel_receipt", {
    p_id: id,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "fuel.receipt_cancelled",
      actorId: profile.id,
      subject: { type: "fuel_receipt", id },
      payload: {
        code,
        fuelTypeName: (meta?.fuel_type as { name?: string } | null)?.name ?? "Nhiên liệu",
        quantity: 0,
        unit: "Lít",
      },
    },
  });

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
    p_driver_id: (parsed.driverId ?? null) as unknown as string,
    p_dispense_type: parsed.dispenseType ?? "vehicle",
  });

  if (error) throw new Error(error.message);

  const dispenseId = data as string;
  let code = "PCNL";
  let zoneName: string | undefined;
  let vehicleName: string | undefined;
  let vehicleCode: string | undefined;
  let fuelTypeName = "Nhiên liệu";
  if (dispenseId) {
    const meta = await fuelDispenseMeta(dispenseId);
    if (meta?.code) code = meta.code;
    zoneName = (meta?.zone as { name?: string } | null)?.name;
    vehicleName = (meta?.vehicle as { name?: string; code?: string } | null)?.name;
    vehicleCode = (meta?.vehicle as { name?: string; code?: string } | null)?.code;
    fuelTypeName = (meta?.fuel_type as { name?: string } | null)?.name ?? "Nhiên liệu";
  }

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "fuel.dispensed",
      actorId: profile.id,
      subject: { type: "fuel_dispense", id: dispenseId },
      participants: { driverId: parsed.driverId },
      payload: {
        code,
        fuelTypeName,
        quantity: parsed.quantity,
        unit: "Lít",
        vehicleCode,
        vehicleName,
        currentOdo: parsed.currentOdo ?? undefined,
        zoneName,
        dispenseType: parsed.dispenseType ?? "vehicle",
        dispenserName: profile.name,
        notes: parsed.notes,
      },
    },
  });

  revalidatePath("/fuel");
  return data as string;
}

export async function cancelFuelDispenseAction(id: string) {
  const profile = await requireManager();
  const supabase = await createClient();

  const meta = await fuelDispenseMeta(id);
  const code = meta?.code ?? "PCNL";

  const { error } = await supabase.rpc("cancel_fuel_dispense", {
    p_id: id,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);

  await dispatchBusinessEvent({
    supabase,
    input: {
      event: "fuel.dispense_cancelled_or_adjusted",
      actorId: profile.id,
      subject: { type: "fuel_dispense", id },
      participants: { driverId: (meta as any)?.driver_id },
      payload: {
        code,
        fuelTypeName: (meta?.fuel_type as { name?: string } | null)?.name ?? "Nhiên liệu",
        quantity: 0,
        unit: "Lít",
        vehicleCode: (meta?.vehicle as { code?: string } | null)?.code,
        vehicleName: (meta?.vehicle as { name?: string } | null)?.name,
        dispenserName: profile.name,
      },
    },
  });

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
      .select("id, code, name, unit, current_stock, min_stock, description, is_active")
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
      description: ft.description ?? null,
      is_active: ft.is_active ?? true,
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
      "id, code, quantity, usage_diff, consumption_rate, dispense_type, created_at, driver_name, vehicle:vehicles(id,code,name,odo_unit,fuel_norm), zone:zones(name), sub_zone:sub_zones(name), fuel_type:fuel_types(name,code)"
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