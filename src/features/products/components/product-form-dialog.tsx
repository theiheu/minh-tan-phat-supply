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
import { uploadProductImage } from "../upload";
import type { AdminProductRow } from "../types";
import { VariantFields } from "./variant-fields";
import { ZoomableImage } from "@/components/image-lightbox";

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

function ImagePicker({
  preview,
  onFile,
}: {
  preview: string | null;
  onFile: (file: File | null, preview: string | null) => void;
}) {
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onFile(file, file ? URL.createObjectURL(file) : null);
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Ảnh</Label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onChange}
        className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
      />
      {preview && (
        <ZoomableImage src={preview} alt="Xem trước" className="h-16 w-16 rounded-lg border object-cover" />
      )}
    </div>
  );
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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
    setImageFile(null);
    setImagePreview(product?.images?.[0] ?? null);

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
        let imageUrl = product?.images?.[0];
        if (imageFile) imageUrl = await uploadProductImage(imageFile);
        const finalImages = imageUrl ? [imageUrl] : product?.images ?? [];

        if (isEdit && product) {
          await updateProduct(product.id, {
            name: name.trim(),
            description,
            categoryId,
            options: (product.options ?? []).join(", "),
            images: finalImages,
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
            images: finalImages,
            variants,
            kit,
          });
          toast.success("Đã tạo vật tư");
        }

        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lưu vật tư thất bại");
      }
    });
  }

  const kitIndex = kitUid ? rows.findIndex((r) => r.uid === kitUid) : -1;

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
              <ImagePicker
                preview={imagePreview}
                onFile={(f, p) => {
                  setImageFile(f);
                  setImagePreview(p);
                }}
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
                onPairs={() => undefined}
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

          {isEdit && !canQuickEdit && (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Vật tư này có nhiều biến thể / cấu tạo bộ — bấm vào tên vật tư trong danh sách để quản lý biến thể
              và linh kiện của bộ.
            </p>
          )}

          {/* Dòng biến thể khi tạo nhiều quy cách / bộ */}
          {!isEdit && mode !== "le" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{mode === "bo" ? "Dòng biến thể (linh kiện + bộ)" : "Dòng quy cách"}</span>
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  + Thêm dòng
                </Button>
              </div>

              {rows.map((r, index) => {
                const isParent = r.uid === kitUid;
                return (
                  <div key={r.uid} className={`space-y-3 rounded-lg border p-3 ${isParent ? "border-primary/60 bg-primary/5" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <span>Dòng {index + 1}</span>
                        <span className="truncate text-xs font-normal text-muted-foreground">{rowPreview(r)}</span>
                        {isParent && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            BỘ LẮP RÁP
                          </span>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(r.uid)}>
                        Xóa dòng
                      </Button>
                    </div>

                    <VariantFields
                      idPrefix={`row-${r.uid}`}
                      pairs={r.attributes}
                      onPairs={(pairs) => setRow(r.uid, { attributes: pairs })}
                      price={r.price}
                      onPrice={(price) => setRow(r.uid, { price })}
                      unit={r.unit}
                      onUnit={(unit) => setRow(r.uid, { unit })}
                      minStock={r.minStock}
                      onMinStock={(minStock) => setRow(r.uid, { minStock })}
                      isTrackableLot={r.isTrackableLot}
                      onTrackableLot={(v) => setRow(r.uid, { isTrackableLot: v })}
                    />

                    {mode === "bo" && (
                      <div className="flex items-center gap-2 border-t pt-2">
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                          <input
                            type="radio"
                            name="kit-parent"
                            checked={isParent}
                            onChange={() => {
                              setKitUid(r.uid);
                              // Mặc định mọi dòng khác là linh kiện với định mức 1.
                              setKitQty((q) => {
                                const next = { ...q };
                                for (const other of rows) {
                                  if (other.uid !== r.uid && !next[other.uid]) next[other.uid] = "1";
                                }
                                return next;
                              });
                            }}
                            className="size-4 accent-primary"
                          />
                          Dòng này là Bộ (lắp ráp từ các dòng còn lại)
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Khai linh kiện cho dòng bộ */}
              {mode === "bo" && kitIndex >= 0 && (
                <div className="rounded-lg border border-primary/40 p-3">
                  <p className="mb-2 text-xs font-semibold">Cấu tạo bộ (dòng {kitIndex + 1})</p>
                  <div className="space-y-1.5">
                    {rows.map((r, index) => {
                      if (r.uid === kitUid) return null;
                      return (
                        <div key={r.uid} className="flex items-center gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            Dòng {index + 1} · {rowPreview(r)}
                          </span>
                          <span className="text-xs text-muted-foreground">SL trong 1 bộ:</span>
                          <Input
                            type="number"
                            min="0"
                            className="h-8 w-20"
                            value={kitQty[r.uid] ?? ""}
                            onChange={(e) => kitQtyRow(r.uid, e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">(0 = không thuộc bộ)</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Tồn của bộ tự tính = số bộ còn ráp được theo linh kiện ít nhất. Linh kiện vẫn bán lẻ riêng được —
                    bán lẻ 1 linh kiện thì số bộ còn ráp được sẽ giảm tương ứng.
                  </p>
                </div>
              )}

              {mode === "quy-cach" && (
                <p className="text-[11px] text-muted-foreground">
                  Mỗi dòng là một quy cách đặt hàng riêng (VD Bao 10kg, Bao 25kg).
                </p>
              )}
            </div>
          )}

          {/* Vật tư lẻ (tạo) */}
          {!isEdit && mode === "le" && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Thông tin vật tư lẻ — nhập thẳng giá & đơn vị, không cần khai biến thể
              </p>
              <VariantFields
                idPrefix="new-le"
                showAttributes={false}
                pairs={[]}
                onPairs={() => undefined}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
