import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/features/products/components/product-card";
import type { VariantWithStock } from "@/features/products/types";
import { categoryIcon } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

const PAGE_SIZE = 12;

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const categoryId = sp.category ?? null;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, icon")
    .is("deleted_at", null)
    .order("display_order");

  let productQuery = supabase
    .from("products")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) productQuery = productQuery.ilike("name", `%${q}%`);
  if (categoryId) productQuery = productQuery.eq("category_id", categoryId);
  const { data: products, count } = await productQuery;

  const productIds = (products ?? []).map((p) => p.id);
  const variantsByProduct = new Map<string, VariantWithStock[]>();

  if (productIds.length > 0) {
    const { data: variantRows } = await supabase
      .from("variants")
      .select("*")
      .in("product_id", productIds)
      .order("price", { ascending: true, nullsFirst: false });

    const variantIds = (variantRows ?? []).map((v) => v.id);
    const [{ data: stockRows }, { data: compRows }] = await Promise.all([
      supabase.from("variant_stock").select("variant_id, quantity").in("variant_id", variantIds),
      supabase.from("variant_components").select("parent_variant_id").in("parent_variant_id", variantIds),
    ]);

    const stockMap = new Map((stockRows ?? []).map((s) => [s.variant_id, s.quantity]));
    const compositeIds = new Set((compRows ?? []).map((c) => c.parent_variant_id));

    for (const v of variantRows ?? []) {
      const enriched: VariantWithStock = {
        ...v,
        stock: stockMap.get(v.id) ?? 0,
        isComposite: compositeIds.has(v.id),
      };
      const list = variantsByProduct.get(v.product_id) ?? [];
      list.push(enriched);
      variantsByProduct.set(v.product_id, list);
    }
  }

  const categoryIconMap = new Map((categories ?? []).map((c) => [c.id, c.icon]));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <form method="get" className="flex gap-2">
        <Input type="search" name="q" defaultValue={q} placeholder="Tìm vật tư…" className="max-w-sm" />
        {categoryId ? <input type="hidden" name="category" value={categoryId} /> : null}
        <Button type="submit" variant="outline">
          Tìm
        </Button>
      </form>

      <div className="grid auto-cols-[5rem] grid-flow-col grid-rows-2 gap-2 overflow-x-auto pb-1">
        <CategoryTile active={!categoryId} href={q ? `?q=${encodeURIComponent(q)}` : "?"} label="Tất cả" icon={LayoutGrid} />
        {(categories ?? []).map((c) => {
          const Icon = categoryIcon(c.icon);
          const href = `?category=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          return (
            <CategoryTile key={c.id} active={categoryId === c.id} href={href} label={c.name} icon={Icon} />
          );
        })}
      </div>

      {(products ?? []).length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Không tìm thấy vật tư nào.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {(products ?? []).map((p: Product) => (
            <ProductCard
              key={p.id}
              product={p}
              variants={variantsByProduct.get(p.id) ?? []}
              categoryIconKey={p.category_id ? categoryIconMap.get(p.category_id) : null}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={`?${q ? `q=${encodeURIComponent(q)}&` : ""}${categoryId ? `category=${categoryId}&` : ""}page=${page - 1}`}>
              Trước
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {page} / {totalPages}
          </span>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link href={`?${q ? `q=${encodeURIComponent(q)}&` : ""}${categoryId ? `category=${categoryId}&` : ""}page=${page + 1}`}>
              Sau
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function CategoryTile({
  active,
  href,
  label,
  icon: Icon,
}: {
  active: boolean;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border p-1.5 text-center transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon className="size-6 shrink-0" />
      <span className="line-clamp-2 text-[11px] leading-tight">{label}</span>
    </Link>
  );
}
