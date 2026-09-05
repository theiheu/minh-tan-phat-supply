"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  productInputSchema,
  productUpdateSchema,
  variantInputSchema,
  type ProductInput,
  type ProductUpdateInput,
  type VariantInput,
} from "./schema";

function parseOptions(options: string): string[] {
  return options
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseAttributes(attributes: string): Record<string, string> {
  return JSON.parse(attributes) as Record<string, string>;
}

function revalidate() {
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function createProduct(input: ProductInput) {
  await requireManager();
  const parsed = productInputSchema.parse(input);

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: parsed.name,
      description: parsed.description || null,
      category_id: parsed.categoryId,
      options: parseOptions(parsed.options),
      images: parsed.images,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  for (const [idx, v] of parsed.variants.entries()) {
    const { error: verr } = await supabase.from("variants").insert({
      product_id: product.id,
      attributes: parseAttributes(v.attributes),
      price: v.price ?? null,
      unit: v.unit ?? null,
      min_stock: v.minStock,
      is_trackable_lot: v.isTrackableLot,
      images: v.images ?? [],
      is_default: idx === 0,
    });
    if (verr) throw new Error(verr.message);
  }

  revalidate();
  return product.id;
}

export async function updateProduct(id: string, input: ProductUpdateInput) {
  await requireManager();
  const parsed = productUpdateSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.name,
      description: parsed.description || null,
      category_id: parsed.categoryId,
      options: parseOptions(parsed.options),
      images: parsed.images,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

export async function createVariant(productId: string, input: VariantInput) {
  await requireManager();
  const parsed = variantInputSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase.from("variants").insert({
    product_id: productId,
    attributes: parseAttributes(parsed.attributes),
    price: parsed.price ?? null,
    unit: parsed.unit ?? null,
    min_stock: parsed.minStock,
    is_trackable_lot: parsed.isTrackableLot,
    images: parsed.images ?? [],
  });
  if (error) throw new Error(error.message);

  revalidate();
}

export async function updateVariant(id: string, input: VariantInput) {
  await requireManager();
  const parsed = variantInputSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase
    .from("variants")
    .update({
      attributes: parseAttributes(parsed.attributes),
      price: parsed.price ?? null,
      unit: parsed.unit ?? null,
      min_stock: parsed.minStock,
      is_trackable_lot: parsed.isTrackableLot,
      images: parsed.images ?? [],
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

export async function deleteVariant(id: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("variants").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

export async function setDefaultVariant(productId: string, variantId: string) {
  await requireManager();
  const supabase = await createClient();

  // Bỏ mặc định của các biến thể khác trong cùng vật tư.
  const { error: unsetErr } = await supabase
    .from("variants")
    .update({ is_default: false })
    .eq("product_id", productId)
    .eq("is_default", true);
  if (unsetErr) throw new Error(unsetErr.message);

  const { error } = await supabase
    .from("variants")
    .update({ is_default: true })
    .eq("id", variantId);
  if (error) throw new Error(error.message);

  revalidate();
}

export async function deleteProduct(id: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}
