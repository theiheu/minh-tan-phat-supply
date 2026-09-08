"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pairsToJson } from "@/lib/attributes";
import { createProduct, updateProduct, updateVariant } from "../actions";
import type { AdminProductRow } from "../types";
import { VariantFields } from "./variant-fields";
import { MultiImagePicker } from "./multi-image-picker";

type CreateMode = "le" | "quy-cach" | "bo";

const MODE_OPTIONS: { value: CreateMode; label: string; hint: string }[] = [
  { value: "le", label: "Lẻ (1 quy cách)", hint: "1 dòng tồn kho, không khai thuộc tính." },
  { value: "quy-cach", label: "Nhiều quy cách", hint: "VD cùng vật tư có 10kg / 25kg." },
  { value: "bo", label: "Bộ lắp ráp", hint: "1 dòng Bộ + các dòng linh kiện bán lẻ được." },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

interface DraftRow {
  uid: string;
  attributes: [string, string][];
  price: string;
  unit: string;
  minStock: string;
  isTrackableLot: boolean;
}

function blankRow(): DraftRow {
  return { uid: uid(), attributes: [["", ""]], price: "", unit: "", minStock: "0", isTrackableLot: false };
}

export function ProductFormDialog({
  open,
  onOpenChange,
  categories,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
  product?: AdminProductRow | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(product);

  // Loại vật tư chỉ chọn khi TẠO mới; khi sửa giữ nguyên theo dữ liệu hiện có.
  const [mode, setMode] = useState<CreateMode>("le");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);

  // Dòng biến thể (dùng cho nhiều quy cách / bộ lắp ráp).
  const [rows, setRows] = useState<DraftRow[]>([blankRow()]);
  // Dòng được đánh dấu là "Bộ" + định mức linh kiện theo uid dòng (0 = không thuộc bộ).
  const [kitUid, setKitUid] = useState<string | null>(null);
  const [kitQty, setKitQty] = useState<Record<string, string>>({});

  // Field nhanh cho vật tư lẻ (tạo) / vật tư đang sửa có đúng 1 biến thể đơn.
  const [lePrice, setLePrice] = useState("");
  const [leUnit, setLeUnit] = useState("");
  const [leMinStock, setLeMinStock] = useState("0");
  const [leTrackableLot, setLeTrackableLot] = useState(false);

  // Vật tư đang sửa có thể chỉnh nhanh giá/đơn vị khi có đúng 1 biến thể (không thuộc tính, không bộ).
  const editVariant = isEdit && product?.variants.length === 1 && !product.variants[0].isComposite
    ? product.variants[0]
    : null;
  const canQuickEdit = Boolean(
    editVariant && (!editVariant.attributes || Object.keys(editVariant.attributes).length === 0),
  );

  function resetForOpen() {
    setName(product?.name ?? "");
    setDescription(product?.description ?? "");
    setCategoryId(product?.categoryId ?? null);
    setImages(product?.images ?? []);

    if (isEdit) {
      // Sửa: không nhảy mode; chỉ điền field nhanh nếu sửa được biến thể đơn.
      setLePrice(editVariant?.price != null ? String(editVariant.price) : "");
      setLeUnit(editVariant?.unit ?? "");
      setLeMinStock(String(editVariant?.minStock ?? 0));
      setLeTrackableLot(Boolean(editVariant?.isTrackableLot));
    } else {
      setMode("le");
      setLePrice("");
      setLeUnit("");
      setLeMinStock("0");
      setLeTrackableLot(false);
      setRows([blankRow()]);
      setKitUid(null);
      setKitQty({});
    }
  }

  useEffect(() => {
    if (open) resetForOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  function pickMode(m: CreateMode) {
    setMode(m);
    setRows([blankRow()]);
    setKitUid(null);
    setKitQty({});
    setLePrice("");
    setLeUnit("");
    setLeMinStock("0");
    setLeTrackableLot(false);
  }

  function setRow(uidRow: string, patch: Partial<DraftRow>) {
    setRows((arr) => arr.map((r) => (r.uid === uidRow ? { ...r, ...patch } : r)));
  }

  function removeRow(uidRow: string) {
    setRows((arr) => arr.filter((r) => r.uid !== uidRow));
    setKitQty((q) => {
      const next = { ...q };
      delete next[uidRow];
      return next;
    });
    if (kitUid === uidRow) setKitUid(null);
  }

  function addRow() {
    setRows((arr) => [...arr, blankRow()]);
  }

  function kitQtyRow(uidRow: string, qty: string) {
    setKitQty((q) => ({ ...q, [uidRow]: qty }));
  }

  function rowPreview(r: DraftRow): string {
    const values = r.attributes.map(([, v]) => v.trim()).filter(Boolean);
    const parts = [...values, r.unit.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "(chưa đặt tên)";
  }

  function draftToVariantInput(r: DraftRow) {
    return {
      attributes: pairsToJson(r.attributes),
      price: r.price === "" ? null : Number(r.price),
      unit: r.unit.trim() || null,
      minStock: Number(r.minStock) || 0,
      isTrackableLot: r.isTrackableLot,
      images: [] as string[],
    };
  }

  function validateCreate(): string | null {
    if (!name.trim()) return "Nhập tên vật tư";
    if (mode === "le") {
      if (!leUnit.trim()) return "Nhập đơn vị cho vật tư (VD: Bao, Cái, Bộ)";
      return null;
    }
    if (rows.length === 0) return "Phải có ít nhất 1 dòng";
    if (rows.every((r) => !rowPreview(r))) return "Đặt tên hoặc đơn vị cho từng dòng";
    if (mode === "bo") {
      if (!kitUid) return "Chọn dòng nào là Bộ (lắp ráp)";
      const parentRow = rows.find((r) => r.uid === kitUid);
      if (!parentRow) return "Không tìm thấy dòng bộ";
      const pieceCount = rows.filter((r) => r.uid !== kitUid && Number(kitQty[r.uid] ?? 0) > 0).length;
      if (pieceCount === 0) return "Bộ phải có ít nhất 1 linh kiện — nhập số lượng cho dòng linh kiện";
      if (!parentRow.unit.trim() && !parentRow.attributes.some(([, v]) => v.trim())) {
        return 'Dòng bộ nên có Đơn vị "Bộ" để dễ nhận biết';
      }
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (isEdit && product) {
          await updateProduct(product.id, {
            name: name.trim(),
            description,
            categoryId,
            options: (product.options ?? []).join(", "),
            images,
          });
          if (canQuickEdit && editVariant) {
            await updateVariant(editVariant.id, {
              attributes: "{}",
              price: lePrice === "" ? null : Number(lePrice),
              unit: leUnit.trim() || null,
              minStock: Number(leMinStock) || 0,
              isTrackableLot: leTrackableLot,
              images: editVariant.images ?? [],
            });
          }
          toast.success("Đã cập nhật vật tư");
        } else {
          const err = validateCreate();
          if (err) {
            toast.error(err);
            return;
          }

          const variants =
            mode === "le"
              ? [
                  {
                    attributes: "{}",
                    price: lePrice === "" ? null : Number(lePrice),
                    unit: leUnit.trim() || null,
                    minStock: Number(leMinStock) || 0,
                    isTrackableLot: leTrackableLot,
                    images: [] as string[],
                  },
                ]
              : rows.map(draftToVariantInput);

          const kit =
            mode === "bo" && kitUid
              ? {
                  parentIndex: rows.findIndex((r) => r.uid === kitUid),
                  components: rows
                    .map((r, index) => ({ index, quantity: Number(kitQty[r.uid] ?? 0) }))
                    .filter((c) => c.quantity > 0),
                }
              : undefined;

          await createProduct({
            name: name.trim(),
            description,
            categoryId,
            options: "",
            images,
            variants,
            kit,
          });
          toast.success("Đã tạo vật tư");
        }
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa vật tư" : "Thêm vật tư"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Cập nhật thông tin vật tư." : "Tạo vật tư lẻ, nhiều quy cách hoặc bộ lắp ráp."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Loại vật tư (chỉ khi tạo) */}
          {!isEdit && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-xs font-semibold">Loại vật tư</Label>
              <div className="flex flex-wrap gap-2">
                {MODE_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => pickMode(m.value)}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      mode === m.value
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    {m.label}
                    <span className="block text-[11px] font-normal text-muted-foreground">{m.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tên vật tư</Label>
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
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <MultiImagePicker
                label="Ảnh vật tư"
                images={images}
                onChange={setImages}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Mô tả</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {/* Sửa vật tư có 1 biến thể đơn → chỉnh nhanh giá/đơn vị/tồn tối thiểu */}
          {isEdit && canQuickEdit && editVariant && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Giá / đơn vị của vật tư (biến thể duy nhất)
              </p>
              <VariantFields
                idPrefix="edit-le"
                showAttributes={false}
                pairs={[]}
                onPairs={() => {}}
                price={lePrice}
                onPrice={setLePrice}
                unit={leUnit}
                onUnit={setLeUnit}
                minStock={leMinStock}
                onMinStock={setLeMinStock}
                isTrackableLot={leTrackableLot}
                onTrackableLot={setLeTrackableLot}
              />
            </div>
          )}

          {/* Tạo mới theo mode */}
          {!isEdit && mode === "le" && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-semibold text-muted-foreground">Thông tin dòng tồn kho duy nhất</p>
              <VariantFields
                idPrefix="create-le"
                showAttributes={false}
                pairs={[]}
                onPairs={() => {}}
                price={lePrice}
                onPrice={setLePrice}
                unit={leUnit}
                onUnit={setLeUnit}
                minStock={leMinStock}
                onMinStock={setLeMinStock}
                isTrackableLot={leTrackableLot}
                onTrackableLot={setLeTrackableLot}
              />
            </div>
          )}

          {!isEdit && (mode === "quy-cach" || mode === "bo") && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">
                    {mode === "bo" ? "Các dòng trong bộ & linh kiện" : "Danh sách quy cách"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {mode === "bo"
                      ? "Đánh dấu 1 dòng là Bộ, các dòng còn lại là linh kiện và nhập số lượng của từng linh kiện."
                      : "Mỗi dòng là 1 quy cách độc lập (tồn kho riêng, giá riêng)."}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  + Thêm dòng
                </Button>
              </div>

              <div className="space-y-3">
                {rows.map((r, idx) => {
                  const isThisKit = kitUid === r.uid;
                  return (
                    <div key={r.uid} className={`rounded-md border p-3 space-y-2.5 ${isThisKit ? "border-primary bg-primary/5" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">
                          Dòng #{idx + 1}: {rowPreview(r)}
                        </span>
                        <div className="flex items-center gap-2">
                          {mode === "bo" && (
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="radio"
                                name="kit-parent"
                                checked={isThisKit}
                                onChange={() => setKitUid(r.uid)}
                              />
                              Là dòng Bộ
                            </label>
                          )}
                          {rows.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRow(r.uid)}
                              className="text-destructive h-7 px-2 text-xs"
                            >
                              Xóa dòng
                            </Button>
                          )}
                        </div>
                      </div>

                      <VariantFields
                        idPrefix={`row-${r.uid}`}
                        showAttributes={true}
                        pairs={r.attributes}
                        onPairs={(p) => setRow(r.uid, { attributes: p })}
                        price={r.price}
                        onPrice={(v) => setRow(r.uid, { price: v })}
                        unit={r.unit}
                        onUnit={(v) => setRow(r.uid, { unit: v })}
                        minStock={r.minStock}
                        onMinStock={(v) => setRow(r.uid, { minStock: v })}
                        isTrackableLot={r.isTrackableLot}
                        onTrackableLot={(v) => setRow(r.uid, { isTrackableLot: v })}
                      />

                      {mode === "bo" && !isThisKit && (
                        <div className="flex items-center gap-2 pt-1 border-t text-xs">
                          <Label className="text-xs">Số lượng dùng trong 1 Bộ:</Label>
                          <Input
                            type="number"
                            min="0"
                            className="w-24 h-8 text-xs"
                            placeholder="0 = không dùng"
                            value={kitQty[r.uid] ?? ""}
                            onChange={(e) => kitQtyRow(r.uid, e.target.value)}
                          />
                          <span className="text-muted-foreground">{r.unit || "đơn vị"}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Tạo vật tư"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
