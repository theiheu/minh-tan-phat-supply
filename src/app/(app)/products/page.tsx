import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryIcon } from "@/components/category-icon";
import { Pagination } from "@/components/pagination";
import { ProductCard } from "@/features/products/components/product-card";
import type { VariantWithStock } from "@/features/products/types";
import { materialLabel } from "@/lib/attributes";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;
const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

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
  if (q) {
    const { data: matchIds, error: matchError } = await supabase.rpc("search_catalog", { p_query: q });
    if (matchError) throw new Error(matchError.message);
    const ids = (matchIds ?? []).map((r) => r.id);
    // PostgREST không chấp nhận .in() với mảng rỗng → dùng uuid sentinel để trả về 0 dòng.
    productQuery = productQuery.in("id", ids.length > 0 ? ids : [EMPTY_UUID]);
  }
  if (categoryId) productQuery = productQuery.eq("category_id", categoryId);
  const { data: products, count } = await productQuery;

  const productIds = (products ?? []).map((p) => p.id);
  const variantsByProduct = new Map<string, VariantWithStock[]>();

  if (productIds.length > 0) {
    const { data: variantRows } = await supabase
      .from("variants")
      .select("*")
      .in("product_id", productIds)
      .order("is_default", { ascending: false })
      .order("price", { ascending: true, nullsFirst: false });

    const variantIds = (variantRows ?? []).map((v) => v.id);
    const [{ data: stockRows }, { data: compRows }] = await Promise.all([
      supabase.from("variant_stock").select("variant_id, quantity").in("variant_id", variantIds),
      supabase
        .from("variant_components")
        .select(
          "parent_variant_id, child_variant_id, quantity, child:variants!variant_components_child_variant_id_fkey(attributes, unit)",
        )
        .in("parent_variant_id", variantIds),
    ]);

    const stockMap = new Map((stockRows ?? []).map((s) => [s.variant_id, s.quantity]));
    const compMap = new Map<string, NonNullable<VariantWithStock["components"]>>();
    for (const c of compRows ?? []) {
      const meta = c.child as { attributes: unknown; unit: string | null } | null;
      const list = compMap.get(c.parent_variant_id) ?? [];
      list.push({
        variantId: c.child_variant_id,
        label: materialLabel(meta?.attributes, meta?.unit),
        unit: meta?.unit ?? null,
        quantity: c.quantity,
      });
      compMap.set(c.parent_variant_id, list);
    }

    for (const v of variantRows ?? []) {
      const enriched: VariantWithStock = {
        ...v,
        stock: stockMap.get(v.id) ?? 0,
        isComposite: compMap.has(v.id),
        components: compMap.get(v.id) ?? [],
      };
      const list = variantsByProduct.get(v.product_id) ?? [];
      list.push(enriched);
      variantsByProduct.set(v.product_id, list);
    }
  }

  const categoryIconMap = new Map((categories ?? []).map((c) => [c.id, c.icon]));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  function categoryHref(id: string | null): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (id) params.set("category", id);
    const s = params.toString();
    return s ? `?${s}` : "?";
  }

  return (
    <div className="space-y-4">
      {/* Ô tìm kiếm — căn giữa, giữ query param category khi tìm trong danh mục đang chọn. */}
      <form method="get" className="mx-auto flex w-full max-w-xl gap-2">
        <Input type="search" name="q" defaultValue={q} placeholder="Tìm vật tư…" className="flex-1" />
        {categoryId ? <input type="hidden" name="category" value={categoryId} /> : null}
        <Button type="submit" variant="outline" className="shrink-0">
          Tìm
        </Button>
      </form>

      {/* Danh mục dạng ô vuông:
          - Mobile (<lg): 2 hàng, dài quá thì cuộn ngang.
          - Desktop (lg+): các ô nhỏ hơn (2/3 kích thước cũ), wrap xuống hàng
            mới thì đi từ trái sang phải (không căn giữa hàng thừa). */}
      <div className="mx-auto grid w-max auto-cols-[4.25rem] grid-flow-col grid-rows-2 gap-2 overflow-x-auto pb-1 sm:auto-cols-[4.75rem] md:auto-cols-[5rem] lg:w-auto lg:flex lg:flex-wrap lg:justify-start lg:gap-x-3 lg:gap-y-2 lg:overflow-visible lg:pb-0 xl:gap-x-4">
        <CategoryTile active={!categoryId} href={categoryHref(null)} label="Tất cả" className="lg:w-16 xl:w-[4.7rem]">
          <LayoutGrid className="size-6 shrink-0 md:size-5" aria-hidden />
        </CategoryTile>
        {(categories ?? []).map((c) => (
          <CategoryTile key={c.id} active={categoryId === c.id} href={categoryHref(c.id)} label={c.name} className="lg:w-16 xl:w-[4.7rem]">
            <CategoryIcon value={c.icon} className="size-6 shrink-0 md:size-5" />
          </CategoryTile>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{count ?? 0} vật tư</p>

      {(products ?? []).length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Không tìm thấy vật tư nào.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
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

      <Pagination basePath="/products" page={page} totalPages={totalPages} params={{ q, category: categoryId }} />
    </div>
  );
}

function CategoryTile({
  active,
  href,
  label,
  children,
  className,
}: {
  active: boolean;
  href: string;
  label: string;
  children: React.ReactNode;
  /** Class thêm cho ô (VD đổi bề rộng ở breakpoint). */
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border p-1 text-center transition-colors",
        className,
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
      <span className="line-clamp-2 text-[11px] leading-tight md:text-xs">{label}</span>
    </Link>
  );
}
