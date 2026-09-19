import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { CatalogManager } from "@/features/catalog/components/catalog-manager";
import { requireManager } from "@/lib/auth";
import { getCachedCategories } from "@/lib/cached-metadata";
import { getAdminProductList } from "@/features/catalog/data";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const profile = await requireManager();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const category = sp.category ?? null;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [categories, { products, count }] = await Promise.all([
    getCachedCategories(),
    getAdminProductList(q, category, PAGE_SIZE, (page - 1) * PAGE_SIZE),
  ]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <SubnavTabs group="admin" userRole={profile.role} />
      <CatalogManager
        products={products}
        categories={categories}
        page={page}
        totalPages={totalPages}
        filters={{ q, category: category ?? "" }}
      />
    </div>
  );
}
