"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { formatDate } from "@/lib/format";
import { deleteProduct } from "../actions";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductVariantsDialog } from "./product-variants-dialog";
import type { AdminProductRow } from "../types";

export function ProductsManager({
  products,
  categories,
  q,
  category,
  sort,
  order,
}: {
  products: AdminProductRow[];
  categories: { id: string; name: string }[];
  q: string;
  category: string;
  sort: string;
  order: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProductRow | null>(null);
  const [variantsProduct, setVariantsProduct] = useState<AdminProductRow | null>(null);

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
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Danh sách vật tư</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          + Thêm vật tư
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Link href={sortHref("name")} className="inline-flex items-center gap-1 hover:text-foreground">
                  Tên {sortIndicator("name")}
                </Link>
              </TableHead>
              <TableHead>Danh mục</TableHead>
              <TableHead>Biến thể (tồn)</TableHead>
              <TableHead>Tồn kho</TableHead>
              <TableHead>
                <Link href={sortHref("created_at")} className="inline-flex items-center gap-1 hover:text-foreground">
                  Ngày tạo {sortIndicator("created_at")}
                </Link>
              </TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Không có vật tư nào.
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setVariantsProduct(p)}
                    className="font-medium text-primary hover:underline"
                  >
                    {p.name}
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.categoryName ?? "—"}</TableCell>
                <TableCell>
                  {p.variants.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="space-y-0.5">
                      {p.variants.map((v) => (
                        <div key={v.id} className="text-xs text-muted-foreground">
                          {v.label} <span className="tabular-nums">· {v.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="tabular-nums font-medium">{p.totalStock}</TableCell>
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
            ))}
          </TableBody>
        </Table>
      </CardContent>

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
    </Card>
  );
}
