import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { ProductsManager } from "@/features/products/components/products-manager";
import { fetchProductVariantRows } from "@/features/products/data";
import type { AdminProductRow } from "@/features/products/types";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; order?: string; page?: string }>;
}) {
  await requireManager();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const category = sp.category ?? null;
  const sort = sp.sort === "created_at" ? "created_at" : "name";
  const order = sp.order === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();

  const [{ data: products, count }, { data: categories }] = await Promise.all([
    (async () => {
      let query = supabase
        .from("products")
        .select("id, name, description, images, options, category_id, created_at, categories(name)", { count: "exact" })
        .is("deleted_at", null);
      if (q) query = query.ilike("name", `%${q}%`);
      if (category) query = query.eq("category_id", category);
      return query
        .order(sort, { ascending: order === "asc" })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    })(),
    supabase.from("categories").select("id, name").is("deleted_at", null).order("display_order"),
  ]);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Biến thể + tồn + cấu tạo bộ (view variant_stock tính tồn bộ = min linh kiện ÷ định mức).
  const productIds = (products ?? []).map((p) => p.id);
  const variantsByProduct = await fetchProductVariantRows(supabase, productIds);

  const rows: AdminProductRow[] = (products ?? []).map((p) => {
    const variantRows = variantsByProduct.get(p.id) ?? [];
    const kitRow = variantRows.find((v) => v.isComposite);
    const isKit = Boolean(kitRow);
    // Vật tư bộ: tồn vật tư = số bộ còn ráp được (không cộng trùng linh kiện).
    const totalStock = kitRow ? kitRow.quantity : variantRows.reduce((n, v) => n + v.quantity, 0);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      images: p.images ?? [],
      options: p.options ?? [],
      categoryId: p.category_id,
      categoryName: p.categories?.name ?? null,
      createdAt: p.created_at,
      variants: variantRows,
      isKit,
      totalStock,
    };
  });

  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-4">
      <SubnavTabs group="admin" />

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

      <Pagination
        basePath="/admin/products"
        page={page}
        totalPages={totalPages}
        params={{ q, category, sort, order }}
      />
    </div>
  );
}
