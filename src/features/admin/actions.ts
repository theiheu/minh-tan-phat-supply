"use server";

import { revalidatePath } from "next/cache";
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
const supplierSchema = z.object({
  name: z.string().min(1, "Tên không được trống"),
  contact_name: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  address: z.string().optional().default(""),
});
const locationSchema = z.object({
  code: z.string().min(1, "Mã không được trống"),
  name: z.string().min(1, "Tên không được trống"),
  type: z.enum(["main", "defect", "repair", "other"]).default("main"),
});

async function softDelete(table: "categories" | "zones" | "suppliers", id: string, path: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(path);
}

// ---- Categories ----
export async function saveCategory(id: string | null, data: Record<string, string>) {
  await requireManager();
  const parsed = categorySchema.parse(data);
  const supabase = await createClient();
  const payload = { name: parsed.name, icon: parsed.icon, display_order: parsed.display_order };
  const { error } = id
    ? await supabase.from("categories").update(payload).eq("id", id)
    : await supabase.from("categories").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
}
export async function deleteCategory(id: string) {
  await softDelete("categories", id, "/admin/categories");
}

// ---- Zones ----
export async function saveZone(id: string | null, data: Record<string, string>) {
  await requireManager();
  const parsed = zoneSchema.parse(data);
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("zones").update({ name: parsed.name, description: parsed.description }).eq("id", id)
    : await supabase.from("zones").insert({ name: parsed.name, description: parsed.description });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/zones");
}
export async function deleteZone(id: string) {
  await softDelete("zones", id, "/admin/zones");
}

// ---- Suppliers ----
export async function saveSupplier(id: string | null, data: Record<string, string>) {
  await requireManager();
  const parsed = supplierSchema.parse(data);
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
}
export async function deleteSupplier(id: string) {
  await softDelete("suppliers", id, "/admin/suppliers");
}

// ---- Stock locations ----
export async function saveLocation(id: string | null, data: Record<string, string>) {
  await requireManager();
  const parsed = locationSchema.parse(data);
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("stock_locations").update({ code: parsed.code, name: parsed.name, type: parsed.type }).eq("id", id)
    : await supabase.from("stock_locations").insert({ code: parsed.code, name: parsed.name, type: parsed.type });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}
export async function deactivateLocation(id: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("stock_locations").update({ is_active: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/locations");
}
