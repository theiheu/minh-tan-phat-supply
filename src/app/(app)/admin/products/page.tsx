import { ProductsManager } from "@/features/products/components/products-manager";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireManager();
  const supabase = await createClient();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, categories(name), variants(count)")
      .is("deleted_at", null)
      .order("name"),
    supabase.from("categories").select("id, name").is("deleted_at", null).order("display_order"),
  ]);

  const rows = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    categoryName: p.categories?.name ?? null,
    variantCount: p.variants?.[0]?.count ?? 0,
  }));

  return <ProductsManager products={rows} categories={categories ?? []} />;
}
