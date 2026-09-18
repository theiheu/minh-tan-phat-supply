// src/features/catalog/components/catalog-manager.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Package, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ZoomableImage } from "@/components/image-lightbox";
import { formatDate } from "@/lib/format";
import type { CatalogProduct } from "../domain/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { deleteProduct } from "../actions";

type SortKey = "name" | "category" | "skus" | "stock" | "status";

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (key: SortKey) => void;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <TableHead
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn("p-0 select-none", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "flex h-10 w-full items-center gap-1.5 px-2 font-bold whitespace-nowrap text-foreground transition-colors hover:text-primary",
          align === "right" && "justify-end text-right",
          align === "center" && "justify-center text-center",
          active && "text-primary",
        )}
        title={`Sắp xếp theo ${label.toLowerCase()}`}
      >
        <span>{label}</span>
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="size-3 shrink-0 opacity-40 hover:opacity-100" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

export function CatalogManager({
  products,
  categories,
  page,
  totalPages,
  filters,
}: {
  products: CatalogProduct[];
  categories: { id: string; name: string }[];
  page: number;
  totalPages: number;
  filters: { q: string; category: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  function handleDeleteProduct(productId: string, productName: string) {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vật tư "${productName}" không?`)) return;
    setDeletingId(productId);
    startTransition(async () => {
      try {
        await deleteProduct(productId);
        toast.success(`Đã xóa vật tư "${productName}" thành công`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa vật tư thất bại");
      } finally {
        setDeletingId(null);
      }
    });
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const sortedProducts = useMemo(() => {
    if (!sort) return products;
    return [...products].sort((a, b) => {
      let comparison = 0;
      switch (sort.key) {
        case "name":
          comparison = a.name.localeCompare(b.name, "vi");
          break;
        case "category":
          comparison = (a.categoryName ?? "").localeCompare(b.categoryName ?? "", "vi");
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name, "vi");
          }
          break;
        case "skus":
          comparison = a.skus.length - b.skus.length;
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name, "vi");
          }
          break;
        case "stock":
          comparison = a.totalAvailable - b.totalAvailable;
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name, "vi");
          }
          break;
        case "status": {
          const statusOrder: Record<string, number> = { active: 1, draft: 2, archived: 3 };
          const orderA = statusOrder[a.catalogStatus] ?? 99;
          const orderB = statusOrder[b.catalogStatus] ?? 99;
          comparison = orderA - orderB;
          if (comparison === 0) {
            comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          break;
        }
      }
      return sort.dir === "asc" ? comparison : -comparison;
    });
  }, [products, sort]);

  const hasFilters = Boolean(filters.q || filters.category);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vật tư</h1>
          <p className="text-sm text-muted-foreground">Quản lý định danh, SKU, đơn vị và BOM.</p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="size-4 mr-2" /> Thêm vật tư
          </Link>
        </Button>
      </div>

      <ListFilters
        basePath="/admin/products"
        title="Lọc vật tư"
        searchPlaceholder="Tìm vật tư…"
        filters={[
          {
            param: "category",
            label: "Danh mục",
            allLabel: "Tất cả danh mục",
            options: categories.map((c) => ({ value: c.id, label: c.name })),
          },
        ]}
        initial={filters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách vật tư</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
              <Package className="mb-3 size-10 text-muted-foreground/60" />
              <p className="font-medium">
                {hasFilters ? "Không tìm thấy vật tư phù hợp" : "Chưa có vật tư"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFilters
                  ? "Hãy thử thay đổi từ khóa hoặc bộ lọc."
                  : "Thêm vật tư đầu tiên để bắt đầu quản lý kho."}
              </p>
              {!hasFilters && (
                <Button className="mt-4" size="sm" asChild>
                  <Link href="/admin/products/new">
                    <Plus className="size-4 mr-2" /> Thêm vật tư
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pr-1">
                    <span className="sr-only">Ảnh</span>
                  </TableHead>
                  <SortHeader label="Tên vật tư" sortKey="name" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Danh mục" sortKey="category" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Tổng số SKU" sortKey="skus" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Tổng tồn kho khả dụng" sortKey="stock" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Trạng thái" sortKey="status" sort={sort} onSort={toggleSort} />
                  <TableHead className="w-[180px]">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.map((p) => {
                  const mainImage = p.images?.[0] || p.skus.find((s) => s.defaultImage)?.defaultImage;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="w-10 py-2 pl-2 pr-1">
                        {mainImage ? (
                          <ZoomableImage
                            src={mainImage}
                            alt={p.name}
                            className="h-10 w-10 min-w-[40px] rounded border object-cover"
                            width={100}
                            height={100}
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted">
                            <Package className="size-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="font-medium">{p.name}</div>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-sm text-muted-foreground">{p.categoryName ?? "—"}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline">{p.skus.length} SKU</Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="font-medium">{p.totalAvailable}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={p.catalogStatus === "active" ? "default" : "secondary"}>
                          {p.catalogStatus === "active" ? "Hoạt động" : p.catalogStatus === "draft" ? "Nháp" : "Lưu trữ"}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">{formatDate(p.createdAt)}</div>
                      </TableCell>
                      <TableCell className="py-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs hover:text-primary hover:border-primary" asChild>
                            <Link href={`/admin/products/${p.id}`}>
                              <Pencil className="size-3" />
                              Sửa / Chi tiết
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            disabled={pending && deletingId === p.id}
                            title={`Xóa vật tư ${p.name}`}
                          >
                            <Trash2 className="size-3" />
                            Xóa
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="mt-4 pt-4 border-t">
              <Pagination basePath="/admin/products" totalPages={totalPages} page={page} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
