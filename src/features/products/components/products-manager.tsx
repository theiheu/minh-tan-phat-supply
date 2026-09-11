"use client";

import { Package, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { kitLabel } from "@/lib/attributes";
import { formatDate } from "@/lib/format";
import { deleteProduct } from "../actions";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductVariantsDialog } from "./product-variants-dialog";
import type { AdminProductRow } from "../types";
import { ZoomableImage } from "@/components/image-lightbox";

/** Ảnh chính của vật tư: ưu tiên ảnh dòng mặc định → ảnh vật tư → dòng đầu có ảnh. */
function productMainImage(p: AdminProductRow): string | null {
  const def = p.variants.find((v) => v.isDefault);
  if (def?.images?.[0]) return def.images[0];
  if (p.images?.[0]) return p.images[0];
  const any = p.variants.find((v) => v.images?.[0]);
  return any?.images?.[0] ?? null;
}

export function ProductsManager({
  products,
  categories,
  page,
  totalPages,
  filters,
}: {
  products: AdminProductRow[];
  categories: { id: string; name: string }[];
  page: number;
  totalPages: number;
  filters: { q: string; category: string; sort: string; order: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProductRow | null>(null);
  const [variantsProduct, setVariantsProduct] = useState<AdminProductRow | null>(null);

  const { q, category, sort, order } = filters;
  const hasFilters = Boolean(q || category);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function sortHref(field: "name" | "created_at") {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const nextOrder = sort === field && order === "asc" ? "desc" : "asc";
    params.set("sort", field);
    params.set("order", nextOrder);
    return `/admin/products?${params.toString()}`;
  }

  function sortIndicator(field: "name" | "created_at") {
    if (sort !== field) return null;
    return order === "asc" ? "↑" : "↓";
  }

  function remove(p: AdminProductRow) {
    if (!window.confirm(`Xóa vật tư "${p.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteProduct(p.id);
        toast.success("Đã xóa vật tư");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa thất bại");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vật tư</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý danh mục, quy cách, linh kiện và tồn kho vật tư.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Thêm vật tư
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
                <Button className="mt-4" size="sm" onClick={openCreate}>
                  <Plus className="size-4" /> Thêm vật tư
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pr-1">
                    <span className="sr-only">Ảnh chính</span>
                  </TableHead>
                  <TableHead>
                    <Link href={sortHref("name")} className="inline-flex items-center gap-1 hover:text-foreground">
                      Tên {sortIndicator("name")}
                    </Link>
                  </TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Quy cách / Linh kiện (tồn)</TableHead>
                  <TableHead>Tồn</TableHead>
                  <TableHead>
                    <Link href={sortHref("created_at")} className="inline-flex items-center gap-1 hover:text-foreground">
                      Ngày tạo {sortIndicator("created_at")}
                    </Link>
                  </TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const kitRow = p.variants.find((v) => v.isComposite);
                  const mainImage = productMainImage(p);
                  const allImages = [
                    ...(p.images ?? []),
                    ...p.variants.flatMap((v) => v.images ?? []),
                  ].filter((u): u is string => Boolean(u));
                  const uniqueImages = [...new Set(allImages)];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="w-10 py-2 pl-2 pr-1">
                        {mainImage ? (
                          <ZoomableImage
                            src={mainImage}
                            images={uniqueImages.length > 0 ? uniqueImages : [mainImage]}
                            alt={p.name}
                            title={p.name}
                            className="size-10 rounded-md border object-cover"
                          />
                        ) : (
                          <div className="size-10 rounded-md border bg-muted" />
                        )}
                      </TableCell>
                      <TableCell className="pl-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setVariantsProduct(p)}
                            title="Xem / sửa quy cách, linh kiện và cấu tạo bộ"
                            className="font-medium text-primary hover:underline"
                          >
                            {p.name}
                          </button>
                          {p.isKit && (
                            <Badge variant="info" className="shrink-0">
                              Bộ
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.categoryName ?? "—"}</TableCell>
                      <TableCell>
                        {p.variants.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="space-y-0.5">
                            {p.variants.map((v) => (
                              <div key={v.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span className={v.isComposite ? "font-medium text-foreground" : ""}>
                                  {v.isComposite ? kitLabel(v.label, v.components) : v.label}
                                </span>
                                <span className="tabular-nums">· {v.quantity}{v.unit ? ` ${v.unit}` : ""}</span>
                                {v.isComposite && <span className="text-[10px] text-primary">(bộ còn ráp được)</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums font-medium">
                        {p.totalStock}
                        {kitRow?.unit ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">{kitRow.unit}</span>
                        ) : (
                          p.variants.find((v) => v.unit)?.unit ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              {p.variants.find((v) => v.unit)?.unit}
                            </span>
                          ) : null
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(p);
                              setFormOpen(true);
                            }}
                          >
                            Sửa
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => remove(p)} disabled={pending}>
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
        </CardContent>
      </Card>

      <Pagination
        basePath="/admin/products"
        page={page}
        totalPages={totalPages}
        params={filters}
      />

      {formOpen && (
        <ProductFormDialog
          key={editing?.id ?? "new"}
          open
          onOpenChange={setFormOpen}
          categories={categories}
          product={editing}
        />
      )}

      {variantsProduct && (
        <ProductVariantsDialog
          key={variantsProduct.id}
          open
          onOpenChange={() => setVariantsProduct(null)}
          product={variantsProduct}
        />
      )}
    </div>
  );
}
