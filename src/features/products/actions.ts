"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { productInputSchema, type ProductInput } from "./schema";

export async function createProduct(input: ProductInput) {
  await requireManager();
  const parsed = productInputSchema.parse(input);

  const supabase = await createClient();
  const options = parsed.options
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: parsed.name,
      description: parsed.description || null,
      category_id: parsed.categoryId,
      options,
      images: parsed.images,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  for (const v of parsed.variants) {
    const attributes = JSON.parse(v.attributes) as Record<string, string>;
    const { error: verr } = await supabase.from("variants").insert({
      product_id: product.id,
      attributes,
      price: v.price ?? null,
      unit: v.unit ?? null,
      min_stock: v.minStock,
      is_trackable_lot: v.isTrackableLot,
    });
    if (verr) throw new Error(verr.message);
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  return product.id;
}

export async function deleteProduct(id: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/products");
}
