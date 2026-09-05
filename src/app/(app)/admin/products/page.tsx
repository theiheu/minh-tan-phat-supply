import { ListFilters } from "@/components/list-filters";
import { ProductsManager } from "@/features/products/components/products-manager";
import { requireManager } from "@/lib/auth";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; order?: string }>;
}) {
  await requireManager();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const category = sp.category ?? null;
  const sort = sp.sort === "created_at" ? "created_at" : "name";
  const order = sp.order === "desc" ? "desc" : "asc";

  const supabase = await createClient();

  const [{ data: products }, { data: categories }] = await Promise.all([
    (async () => {
      let query = supabase
        .from("products")
        .select("id, name, description, images, options, category_id, created_at, categories(name)")
        .is("deleted_at", null);
      if (q) query = query.ilike("name", `%${q}%`);
      if (category) query = query.eq("category_id", category);
      return query.order(sort, { ascending: order === "asc" });
    })(),
    supabase.from("categories").select("id, name").is("deleted_at", null).order("display_order"),
  ]);

  // Biến thể + tồn kho (theo view variant_stock) để hiển thị trong bảng.
  const productIds = (products ?? []).map((p) => p.id);
  const variantsByProduct = new Map<string, { id: string; label: string; quantity: number }[]>();

  if (productIds.length > 0) {
    const { data: variantRows } = await supabase
      .from("variants")
      .select("id, product_id, attributes, unit")
      .in("product_id", productIds)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    const variantIds = (variantRows ?? []).map((v) => v.id);
    const { data: stockRows } = await supabase
      .from("variant_stock")
      .select("variant_id, quantity")
      .in("variant_id", variantIds);

    const stockMap = new Map((stockRows ?? []).map((s) => [s.variant_id, s.quantity]));

    for (const v of variantRows ?? []) {
      const item = { id: v.id, label: variantLabel(v.attributes, v.unit), quantity: stockMap.get(v.id) ?? 0 };
      const list = variantsByProduct.get(v.product_id) ?? [];
      list.push(item);
      variantsByProduct.set(v.product_id, list);
    }
  }

  const rows = (products ?? []).map((p) => {
    const variants = variantsByProduct.get(p.id) ?? [];
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      images: p.images ?? [],
      options: p.options ?? [],
      categoryId: p.category_id,
      categoryName: p.categories?.name ?? null,
      createdAt: p.created_at,
      variants,
      totalStock: variants.reduce((n, v) => n + v.quantity, 0),
    };
  });

  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-4">
      <ListFilters
        basePath="/admin/products"
        searchPlaceholder="Tìm vật tư…"
        title="Lọc vật tư"
        filters={[{ param: "category", label: "Danh mục", options: categoryOptions }]}
        initial={{ q, category: category ?? "" }}
      />

      <ProductsManager
        products={rows}
        categories={categories ?? []}
        q={q}
        category={category ?? ""}
        sort={sort}
        order={order}
      />
    </div>
  );
}
