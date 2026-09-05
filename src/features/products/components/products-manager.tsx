"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createProduct, deleteProduct } from "../actions";

interface VariantDraft {
  attributes: string;
  price: string;
  unit: string;
  minStock: string;
  isTrackableLot: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  categoryName: string | null;
  variantCount: number;
}

const EMPTY_VARIANT: VariantDraft = {
  attributes: "{}",
  price: "",
  unit: "",
  minStock: "0",
  isTrackableLot: false,
};

export function ProductsManager({
  products,
  categories,
}: {
  products: ProductRow[];
  categories: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [options, setOptions] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([EMPTY_VARIANT]);

  function setVariant(i: number, patch: Partial<VariantDraft>) {
    setVariants((v) => v.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createProduct({
          name,
          description,
          categoryId,
          options,
          variants: variants.map((v) => ({
            attributes: v.attributes,
            price: v.price === "" ? null : Number(v.price),
            unit: v.unit || null,
            minStock: Number(v.minStock) || 0,
            isTrackableLot: v.isTrackableLot,
          })),
        });
        toast.success("Đã tạo sản phẩm");
        setName("");
        setDescription("");
        setCategoryId(null);
        setOptions("");
        setVariants([EMPTY_VARIANT]);
        setShowForm(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo sản phẩm thất bại");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteProduct(id);
        toast.success("Đã xóa sản phẩm");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa thất bại");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Đóng" : "Thêm sản phẩm"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sản phẩm mới</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tên sản phẩm</Label>
                  <Input required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Danh mục</Label>
                  <Select value={categoryId ?? "none"} onValueChange={(v) => setCategoryId(v === "none" ? null : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Không —</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Mô tả</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Options (phân cách bằng dấu phẩy)</Label>
                  <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Trọng lượng, Liều" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Biến thể</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setVariants((v) => [...v, EMPTY_VARIANT])}>
                    + Thêm biến thể
                  </Button>
                </div>
                {variants.map((v, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-6">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Thuộc tính (JSON)</Label>
                      <Input value={v.attributes} onChange={(e) => setVariant(i, { attributes: e.target.value })} placeholder='{"Trọng lượng":"Bao 10kg"}' />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Giá</Label>
                      <Input type="number" min="0" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Đơn vị</Label>
                      <Input value={v.unit} onChange={(e) => setVariant(i, { unit: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tồn tối thiểu</Label>
                      <Input type="number" min="0" value={v.minStock} onChange={(e) => setVariant(i, { minStock: e.target.value })} />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={v.isTrackableLot} onChange={(e) => setVariant(i, { isTrackableLot: e.target.checked })} className="size-4 accent-primary" />
                        Theo lô
                      </label>
                      <Button type="button" variant="ghost" size="icon-xs" onClick={() => setVariants((arr) => arr.filter((_, idx) => idx !== i))} aria-label="Xóa biến thể">
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu…" : "Tạo sản phẩm"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách sản phẩm</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Số biến thể</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.categoryName ?? "—"}</TableCell>
                  <TableCell>{p.variantCount}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="destructive" onClick={() => remove(p.id)} disabled={pending}>
                      Xóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
