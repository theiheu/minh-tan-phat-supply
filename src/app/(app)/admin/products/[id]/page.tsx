import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { getProductDetails, getUnits } from "@/features/catalog/data";
import { getCachedCategories } from "@/lib/cached-metadata";
import { CatalogDetailView } from "@/features/catalog/components/catalog-detail-view";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManager();
  const { id } = await params;

  const [productData, categories, units] = await Promise.all([
    getProductDetails(id),
    getCachedCategories(),
    getUnits(),
  ]);

  if (!productData) {
    notFound();
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb + back */}
      <div className="flex flex-col gap-1.5">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link
            href="/admin/products"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Danh sách vật tư
          </Link>
          <ChevronRight className="size-3.5 shrink-0" />
          <span className="truncate text-foreground font-medium">{productData.product.name}</span>
        </nav>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{productData.product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {productData.product.categoryName || "Chưa phân loại"} · {productData.skus.length} quy cách (SKU)
          </p>
        </div>
      </div>

      <CatalogDetailView data={productData} categories={categories} units={units} />
    </div>
  );
}
