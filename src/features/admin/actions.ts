"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const categorySchema = z.object({
  name: z.string().min(1, "Tên không được trống"),
  icon: z.string().default("other"),
  display_order: z.coerce.number().int().default(0),
});
const zoneSchema = z.object({
  name: z.string().min(1, "Tên không được trống"),
  description: z.string().optional().default(""),
});
const zoneWithSubZonesSchema = z.object({
  name: z.string().trim().min(1, "Tên không được trống"),
  description: z.string().optional().default(""),
  subZones: z.array(z.string().trim().min(1)).optional().default([]),
});
const supplierSchema = z.object({
  name: z.string().min(1, "Tên không được trống"),
  contact_name: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  address: z.string().optional().default(""),
});
const customerSchema = z.object({
  name: z.string().min(1, "Tên không được trống"),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});
const locationSchema = z.object({
  code: z.string().min(1, "Mã không được trống"),
  name: z.string().min(1, "Tên không được trống"),
  type: z.enum(["main", "defect", "repair", "other"]).default("main"),
});

// Parse và ném ra thông báo lỗi đầu tiên đọc được (thay vì mảng JSON thô của ZodError).
function requireValid<T>(
  schema: {
    safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
  },
  data: unknown,
): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  return r.data;
}

async function softDelete(table: "categories" | "zones" | "suppliers" | "customers", id: string, path: string, tag?: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(path);
  if (tag) revalidateTag(tag);
}

// ---- Categories ----
export async function saveCategory(id: string | null, data: Record<string, string>) {
  await requireManager();
  const parsed = requireValid(categorySchema, data);
  const supabase = await createClient();
  const payload = { name: parsed.name, icon: parsed.icon, display_order: parsed.display_order };
  const { error } = id
    ? await supabase.from("categories").update(payload).eq("id", id)
    : await supabase.from("categories").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
  revalidateTag("metadata:categories");
}
export async function deleteCategory(id: string) {
  await softDelete("categories", id, "/admin/categories", "metadata:categories");
}

// ---- Zones ----
export async function saveZone(id: string | null, data: Record<string, string>) {
  await requireManager();
  const parsed = requireValid(zoneSchema, data);
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("zones").update({ name: parsed.name, description: parsed.description }).eq("id", id)
    : await supabase.from("zones").insert({ name: parsed.name, description: parsed.description });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/zones");
  revalidateTag("metadata:zones");
}

export async function saveZoneWithSubZones(
  id: string | null,
  data: { name: string; description?: string; subZones?: string[] }
) {
  await requireManager();
  const parsed = zoneWithSubZonesSchema.parse(data);
  const supabase = await createClient();

  let zoneId = id;
  if (zoneId) {
    const { error } = await supabase
      .from("zones")
      .update({ name: parsed.name, description: parsed.description || null })
      .eq("id", zoneId);
    if (error) throw new Error(error.message);
  } else {
    const { data: newZone, error } = await supabase
      .from("zones")
      .insert({ name: parsed.name, description: parsed.description || null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    zoneId = newZone.id;
  }

  // Quản lý sub_zones:
  const { data: existingSubZones, error: fetchErr } = await supabase
    .from("sub_zones")
    .select("id, name, deleted_at")
    .eq("zone_id", zoneId);

  if (fetchErr) throw new Error(fetchErr.message);

  const incomingNames = (parsed.subZones ?? []).map((s) => s.trim()).filter(Boolean);
  const uniqueIncomingNames: string[] = [];
  const seen = new Set<string>();
  for (const name of incomingNames) {
    const lower = name.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueIncomingNames.push(name);
    }
  }

  const existingMap = new Map<string, { id: string; name: string; deleted_at: string | null }>();
  for (const sz of existingSubZones ?? []) {
    existingMap.set(sz.name.toLowerCase(), sz);
  }

  // A. Soft-delete các sub_zones không còn trong danh sách mới
  const activeExisting = (existingSubZones ?? []).filter((sz) => sz.deleted_at === null);
  for (const active of activeExisting) {
    if (!seen.has(active.name.toLowerCase())) {
      await supabase
        .from("sub_zones")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", active.id);
    }
  }

  // B. Thêm mới hoặc khôi phục (restore) các sub_zones trong danh sách
  for (let idx = 0; idx < uniqueIncomingNames.length; idx++) {
    const name = uniqueIncomingNames[idx];
    const match = existingMap.get(name.toLowerCase());
    if (match) {
      await supabase
        .from("sub_zones")
        .update({ name, deleted_at: null, display_order: idx })
        .eq("id", match.id);
    } else {
      await supabase
        .from("sub_zones")
        .insert({ zone_id: zoneId, name, display_order: idx });
    }
  }

  revalidatePath("/admin/zones");
  revalidateTag("metadata:zones");
  revalidateTag("metadata:sub_zones");
}

export async function deleteZone(id: string) {
  await softDelete("zones", id, "/admin/zones", "metadata:zones");
  revalidateTag("metadata:sub_zones");
}

// ---- Suppliers ----
export async function saveSupplier(id: string | null, data: Record<string, string>) {
  await requireManager();
  const parsed = requireValid(supplierSchema, data);
  const supabase = await createClient();
  const payload = {
    name: parsed.name,
    contact_name: parsed.contact_name || null,
    phone: parsed.phone || null,
    email: parsed.email || null,
    address: parsed.address || null,
  };
  const { error } = id
    ? await supabase.from("suppliers").update(payload).eq("id", id)
    : await supabase.from("suppliers").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/suppliers");
  revalidateTag("metadata:suppliers");
}
export async function deleteSupplier(id: string) {
  await softDelete("suppliers", id, "/admin/suppliers", "metadata:suppliers");
}

// ---- Customers ----
export async function saveCustomer(id: string | null, data: Record<string, string>) {
  await requireManager();
  const parsed = requireValid(customerSchema, data);
  const supabase = await createClient();
  const payload = {
    name: parsed.name,
    phone: parsed.phone || null,
    address: parsed.address || null,
    notes: parsed.notes || null,
  };
  const { error } = id
    ? await supabase.from("customers").update(payload).eq("id", id)
    : await supabase.from("customers").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/customers");
  revalidateTag("metadata:customers");
}
export async function deleteCustomer(id: string) {
  await softDelete("customers", id, "/admin/customers", "metadata:customers");
}

// ---- Stock locations ----
export async function saveLocation(id: string | null, data: Record<string, string>) {
  await requireManager();
  const parsed = requireValid(locationSchema, data);
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("stock_locations").update({ code: parsed.code, name: parsed.name, type: parsed.type }).eq("id", id)
    : await supabase.from("stock_locations").insert({ code: parsed.code, name: parsed.name, type: parsed.type });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
  revalidateTag("metadata:locations");
}
export async function deactivateLocation(id: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("stock_locations").update({ is_active: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
  revalidateTag("metadata:locations");
}
