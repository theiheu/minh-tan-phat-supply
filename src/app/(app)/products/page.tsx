import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { Pagination } from "@/components/pagination";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { ProductCard } from "@/features/products/components/product-card";
import { ProductSearchBar } from "@/features/products/components/product-search-bar";
import type { VariantWithStock } from "@/features/products/types";
import { getCachedCategories } from "@/lib/cached-metadata";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { isPrivileged, type Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { computeSearchScore } from "@/lib/search";
import { variantLabel } from "@/lib/labels";

const PAGE_SIZE = 20;

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

  const [supabase, categories, profile] = await Promise.all([
    createClient(),
    getCachedCategories(),
    getCurrentProfile(),
  ]);

  const canManage = isPrivileged(profile?.role);

  let products: Array<{
    id: string;
    name: string;
    description: string | null;
    images: string[] | null;
    category_id: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    catalog_status: string;
    categories: { name: string } | null;
    product_attribute_definitions: Array<{
      display_order: number;
      is_variant_axis: boolean;
      attribute_definitions: { name: string } | null;
    }>;
  }> = [];
  let count = 0;

  if (q) {
    const { data: matchIds } = await supabase.rpc("search_catalog", { p_query: q });
    const matchedProductIds = (matchIds ?? []).map((r) => r.id);

    if (matchedProductIds.length > 0) {
      let filteredIds = matchedProductIds;
      if (categoryId) {
        const { data: catProds } = await supabase
          .from("products")
          .select("id")
          .eq("category_id", categoryId)
          .neq("catalog_status", "archived")
          .is("deleted_at", null);
        const catSet = new Set((catProds ?? []).map((c) => c.id));
        filteredIds = matchedProductIds.filter((id) => catSet.has(id));
      }

      count = filteredIds.length;
      const pageIds = filteredIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

      if (pageIds.length > 0) {
        const { data: pageProds } = await supabase
          .from("products")
          .select(`
            id, name, description, images, category_id, created_at, updated_at, deleted_at, catalog_status,
            categories(name),
            product_attribute_definitions(display_order, is_variant_axis, attribute_definitions(name))
          `)
          .in("id", pageIds);

        const rankMap = new Map(pageIds.map((id, idx) => [id, idx]));
        products = ((pageProds ?? []) as unknown as typeof products).sort(
          (a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999)
        );
      }
    }
  } else {
    let productQuery = supabase
      .from("products")
      .select(`
        id, name, description, images, category_id, created_at, updated_at, deleted_at, catalog_status,
        categories(name),
        product_attribute_definitions(display_order, is_variant_axis, attribute_definitions(name))
      `, { count: "exact" })
      .neq("catalog_status", "archived")
      .is("deleted_at", null)
      .order("name")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (categoryId) {
      productQuery = productQuery.eq("category_id", categoryId);
    }

    const res = await productQuery;
    products = (res.data ?? []) as unknown as typeof products;
    count = res.count ?? 0;
  }

  const productIds = (products ?? []).map((p) => p.id);
  const variantsByProduct = new Map<string, VariantWithStock[]>();

  if (productIds.length > 0) {
    const [{ data: variantRows }, { data: stockRows }] = await Promise.all([
      supabase
        .from("skus")
        .select(`
          id, sku_code, product_id, is_default, images, min_stock, sku_status, price, tracking_policy, inventory_policy,
          units(name, symbol),
          sku_attribute_values(
            text_value, numeric_value, boolean_value, legacy_text_value, option_value_id,
            attribute_definitions(name),
            units(symbol),
            attribute_option_values:attribute_option_values!sku_attribute_values_option_value_id_fkey(label, code)
          )
        `)
        .in("product_id", productIds)
        .neq("sku_status", "inactive")
        .order("is_default", { ascending: false }),
      supabase
        .from("stock_balances")
        .select("sku_id, quantity, reserved_quantity")
        .in("sku_id", (
          await supabase.from("skus").select("id").in("product_id", productIds)
        ).data?.map(v => v.id) || []),
    ]);

    const stockMap = new Map<string, number>();
    for (const s of stockRows || []) {
      const current = stockMap.get(s.sku_id) || 0;
      stockMap.set(s.sku_id, current + Math.max(0, Number(s.quantity) - Number(s.reserved_quantity || 0)));
    }

    const productPadMapByProduct = new Map<string, Map<string, number>>();
    for (const p of products ?? []) {
      const m = new Map<string, number>();
      for (const pad of (p.product_attribute_definitions ?? []) as Array<{ display_order: number; attribute_definitions?: { name?: string } | null }>) {
        if (pad.attribute_definitions?.name) {
          m.set(pad.attribute_definitions.name, pad.display_order);
        }
      }
      productPadMapByProduct.set(p.id, m);
    }

    for (const v of variantRows || []) {
      const unitObj = v.units as unknown as { name?: string; symbol?: string } | null;
      const unit = unitObj?.symbol || unitObj?.name || null;
      const attrObj: Record<string, string> = {};

      const padMap = productPadMapByProduct.get(v.product_id);
      const rawAvs = [...((v.sku_attribute_values ?? []) as Array<{
        attribute_definitions?: { name?: string } | null;
        text_value?: string | null;
        legacy_text_value?: string | null;
        numeric_value?: number | null;
        units?: { symbol?: string | null } | null;
        attribute_option_values?: { label?: string; code?: string } | null;
      }>)];

      if (padMap) {
        rawAvs.sort((a, b) => {
          const nameA = a.attribute_definitions?.name || "";
          const nameB = b.attribute_definitions?.name || "";
          return (padMap.get(nameA) ?? 999) - (padMap.get(nameB) ?? 999);
        });
      }

      for (const av of rawAvs) {
        const key = av.attribute_definitions?.name || "Thuộc tính";
        const val = av.text_value || av.attribute_option_values?.label || av.attribute_option_values?.code || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : "");
        if (val) attrObj[key] = val;
      }

      const enriched: VariantWithStock = {
        id: v.id,
        sku_code: v.sku_code,
        product_id: v.product_id,
        unit,
        price: v.price ? Number(v.price) : null,
        min_stock: v.min_stock ?? 0,
        is_default: v.is_default ?? false,
        is_trackable_lot: v.tracking_policy === "lot_expiry" || v.tracking_policy === "lot_only",
        attributes: attrObj,
        images: v.images ?? [],
        created_at: "",
        updated_at: "",
        stock: stockMap.get(v.id) ?? 0,
        isComposite: v.inventory_policy === "virtual_kit" || v.inventory_policy === "stocked_assembly",
        components: [],
      };
      const list = variantsByProduct.get(v.product_id) ?? [];
      list.push(enriched);
      variantsByProduct.set(v.product_id, list);
    }

    // Sort variants within each product when search query is present
    if (q) {
      for (const [, pvars] of variantsByProduct.entries()) {
        pvars.sort((a, b) => {
          const aText = `${variantLabel(a.attributes, a.unit)} ${a.sku_code || ""}`;
          const bText = `${variantLabel(b.attributes, b.unit)} ${b.sku_code || ""}`;
          const aScore = computeSearchScore(aText, q, a.sku_code);
          const bScore = computeSearchScore(bText, q, b.sku_code);
          return bScore - aScore;
        });
      }
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
      <SubnavTabs group="requisitions" />

      {/* Ô tìm kiếm kèm nút quét QR/Barcode */}
      <ProductSearchBar defaultValue={q} categoryId={categoryId} />

      {/* Danh mục dạng ô vuông */}
      <div className="w-full max-w-full overflow-x-auto pb-2 scrollbar-none -mx-2.5 px-2.5 sm:mx-0 sm:px-0 lg:overflow-visible lg:pb-0">
        <div className="grid w-max auto-cols-[4.25rem] grid-flow-col grid-rows-2 gap-2 sm:auto-cols-[4.75rem] md:auto-cols-[5rem] lg:w-auto lg:flex lg:flex-wrap lg:justify-start lg:gap-x-3 lg:gap-y-2 xl:gap-x-4">
          <CategoryTile active={!categoryId} href={categoryHref(null)} label="Tất cả" className="lg:w-16 xl:w-[4.7rem]">
            <LayoutGrid className="size-6 shrink-0 md:size-5" aria-hidden />
          </CategoryTile>
          {(categories ?? []).map((c) => (
            <CategoryTile key={c.id} active={categoryId === c.id} href={categoryHref(c.id)} label={c.name} className="lg:w-16 xl:w-[4.7rem]">
              <CategoryIcon value={c.icon} className="size-6 shrink-0 md:size-5" />
            </CategoryTile>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{count ?? 0} vật tư khả dụng</span>
      </div>

      {(products ?? []).length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
          Không tìm thấy vật tư nào phù hợp.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {(products ?? []).map((p) => {
            const options = ((p.product_attribute_definitions ?? []) as Array<{ display_order: number; attribute_definitions?: { name?: string } | null }>)
              .sort((a, b) => a.display_order - b.display_order)
              .map((pad) => pad.attribute_definitions?.name?.trim())
              .filter((name): name is string => Boolean(name));

            const productObj: Product = {
              ...(p as unknown as Product),
              options,
              categoryName: (p.categories as { name: string } | null)?.name ?? null,
            };

            return (
              <ProductCard
                key={p.id}
                product={productObj}
                skus={variantsByProduct.get(p.id) ?? []}
                categoryIconKey={p.category_id ? categoryIconMap.get(p.category_id) : null}
                canManage={canManage}
                categories={categories}
                searchQuery={q}
              />
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 pt-4 border-t">
          <Pagination basePath="/products" totalPages={totalPages} page={page} params={{ q, category: categoryId }} />
        </div>
      )}

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