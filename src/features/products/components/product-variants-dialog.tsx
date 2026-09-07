"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { formatVnd } from "@/lib/format";
import { attributesToPairs, pairsToJson, kitLabel } from "@/lib/attributes";
import {
  createVariant,
  deleteVariant,
  getProductVariants,
  saveVariantComponents,
  setDefaultVariant,
  updateVariant,
} from "../actions";
import { uploadProductImage } from "../upload";
import type { AdminProductRow, AdminVariantRow } from "../types";
import { VariantFields } from "./variant-fields";
import { ZoomableImage } from "@/components/image-lightbox";

type LoadState = "loading" | "ready" | "error";

export function ProductVariantsDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: AdminProductRow | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [variants, setVariants] = useState<AdminVariantRow[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form sửa/thêm dòng.
  const [editing, setEditing] = useState<AdminVariantRow | null>(null);
  const [pairs, setPairs] = useState<[string, string][]>([["", ""]]);
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [isTrackableLot, setIsTrackableLot] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Đánh dấu dòng là "bộ lắp ráp" + định mức linh kiện.
  const [isKit, setIsKit] = useState(false);
  const [kitQty, setKitQty] = useState<Record<string, string>>({});
  // Chỉ khi SỬA 1 dòng mới được đặt dòng đó làm mặc định.
  const [wantDefault, setWantDefault] = useState(false);

  async function load() {
    if (!product) return;
    setLoadState("loading");
    setLoadError("");
    try {
      const payload = await getProductVariants(product.id);
      setVariants(payload.variants);
      setLoadState("ready");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Không tải được biến thể");
      setLoadState("error");
    }
  }

  useEffect(() => {
    if (open && product) {
      resetForm();
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  // Danh sách linh kiện có thể chọn cho dòng bộ: các dòng KHÔNG phải bộ, khác dòng đang sửa.
  const kitCandidates = variants.filter((v) => !v.isComposite && v.id !== editing?.id);

  function resetForm() {
    setEditing(null);
    setPairs([["", ""]]);
    setPrice("");
    setUnit("");
    setMinStock("0");
    setIsTrackableLot(false);
    setIsKit(false);
    setKitQty({});
    setWantDefault(false);
    setImageFile(null);
    setImagePreview(null);
    setShowForm(false);
  }

  function startEdit(v: AdminVariantRow) {
    setEditing(v);
    setPairs(attributesToPairs(v.attributes ?? {}));
    setPrice(v.price != null ? String(v.price) : "");
    setUnit(v.unit ?? "");
    setMinStock(String(v.minStock ?? 0));
    setIsTrackableLot(v.isTrackableLot ?? false);
    setIsKit(v.isComposite);
    setWantDefault(v.isDefault);
    const qty: Record<string, string> = {};
    for (const c of v.components) qty[c.variantId] = String(c.quantity);
    setKitQty(qty);
    setImageFile(null);
    setImagePreview(v.images?.[0] ?? null);
    setShowForm(true);
  }

  function openAdd() {
    resetForm();
    setEditing(null);
    setShowForm(true);
  }

  function openAddKit() {
    resetForm();
    setEditing(null);
    setIsKit(true);
    setShowForm(true);
  }

  function toggleAdd() {
    if (showForm) resetForm();
    else openAdd();
  }

  function toggleAddKit() {
    if (showForm) resetForm();
    else openAddKit();
  }

  function removeVariant(v: AdminVariantRow) {
    const isBom = v.isComposite && v.components.length > 0;
    const msg = isBom
      ? `Xóa dòng bộ "${v.label}"? Cấu tạo bộ cũng sẽ bị xóa (linh kiện vẫn giữ nguyên).`
      : `Xóa biến thể "${v.label}"?`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      try {
        await deleteVariant(v.id);
        toast.success("Đã xóa dòng");
        resetForm();
        await load();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa thất bại");
      }
    });
  }

  function kitQuantityInputs(): { variantId: string; quantity: number }[] {
    return kitCandidates
      .map((c) => ({ variantId: c.id, quantity: Number(kitQty[c.id] ?? 0) }))
      .filter((c) => c.quantity > 0);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    const errMsg = validateForm();
    if (errMsg) {
      toast.error(errMsg);
      return;
    }
    startTransition(async () => {
      try {
        let url: string | undefined;
        if (imageFile) url = await uploadProductImage(imageFile);
        const input = {
          attributes: pairsToJson(pairs),
          price: price === "" ? null : Number(price),
          unit: unit.trim() || null,
          minStock: Number(minStock) || 0,
          isTrackableLot,
          images: url ? [url] : editing?.images?.[0] ? [editing.images[0]] : [],
        };

        if (editing) {
          await updateVariant(editing.id, input);
          if (isKit) {
            // Ghi (hoặc ghi đè) cấu tạo bộ theo các linh kiện đã chọn.
            await saveVariantComponents(editing.id, kitQuantityInputs());
          } else if (editing.isComposite) {
            // Gỡ trạng thái bộ: dòng trở về biến thể thường.
            await saveVariantComponents(editing.id, []);
          }
          // Đặt mặc định ngay trong màn sửa (nếu vừa tích chọn).
          if (wantDefault && !editing.isDefault) {
            await setDefaultVariant(product.id, editing.id);
          }
          toast.success("Đã cập nhật dòng");
        } else {
          const id = await createVariant(product.id, input);
          if (isKit && kitQuantityInputs().length > 0) {
            await saveVariantComponents(id, kitQuantityInputs());
          }
          toast.success("Đã thêm dòng");
        }

        resetForm();
        await load();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lưu dòng thất bại");
      }
    });
  }

  function validateForm(): string | null {
    if (isKit && kitCandidates.length > 0 && kitQuantityInputs().length === 0) {
      return "Bộ phải có ít nhất 1 linh kiện — nhập số lượng cho linh kiện";
    }
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Biến thể · {product?.name}</DialogTitle>
          <DialogDescription>
            Quản lý quy cách, dòng bộ (lắp ráp) và linh kiện. Tồn của bộ tự tính theo linh kiện còn đủ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadState === "loading" && (
            <div className="space-y-2 py-4">
              <p className="text-sm text-muted-foreground">Đang tải…</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
              </div>
            </div>
          )}

          {loadState === "error" && (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <div>
                  <p className="font-medium">Không tải được biến thể</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{loadError}</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={load}>
                <RefreshCw className="size-3.5" aria-hidden /> Thử lại
              </Button>
            </div>
          )}

          {loadState === "ready" &&
            (variants.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Chưa có dòng nào.</p>
            ) : (
              <ul className="space-y-2">
                {variants.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 rounded-lg border p-3">
                    {v.images?.[0] ? (
                      <ZoomableImage
                        src={v.images[0]}
                        images={v.images}
                        alt={v.label}
                        title={product?.name ? `${product.name} · ${v.label}` : v.label}
                        className="size-12 rounded-md border object-cover"
                      />
                    ) : (
                      <div className="size-12 shrink-0 rounded-md border bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {v.isComposite ? kitLabel(v.label, v.components) : v.label}
                        </span>
                        {v.isComposite && (
                          <Badge variant="info" className="shrink-0">
                            Bộ lắp ráp
                          </Badge>
                        )}
                        {v.isDefault && (
                          <Badge variant="warning" className="shrink-0">
                            Mặc định
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs break-words text-muted-foreground">
                        {v.price != null ? formatVnd(v.price) : "—"} · Tồn tối thiểu {v.minStock} · Đơn vị {v.unit ?? "—"}
                        {v.isTrackableLot ? " · Theo lô" : ""}
                      </div>
                      {v.isComposite && v.components.length > 0 && (
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          Gồm: {v.components.map((c) => `${c.label} ×${c.quantity}`).join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-sm font-semibold tabular-nums ${v.quantity === 0 ? "text-red-600" : ""}`}>
                        {v.quantity}
                      </div>
                      <div className="max-w-24 text-[10px] text-muted-foreground">
                        {v.isComposite ? "bộ còn ráp được" : v.unit ? `tồn (${v.unit})` : "tồn"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(v)}>
                        Sửa
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => removeVariant(v)} disabled={pending}>
                        Xóa
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {loadState === "ready" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={toggleAdd}>
                {showForm ? "Đóng" : "+ Thêm quy cách / linh kiện"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={toggleAddKit}>
                {showForm && !editing && isKit ? "Đóng" : "+ Thêm dòng Bộ (lắp ráp)"}
              </Button>
              {showForm && !editing && isKit && (
                <p className="text-[11px] text-muted-foreground">
                  Mẹo: tạo đủ các dòng linh kiện trước, rồi tạo dòng Bộ để chọn linh kiện.
                </p>
              )}
            </div>
          )}

          {showForm && (
            <form onSubmit={submit} className="space-y-3 rounded-lg border p-3">
              <VariantFields
                idPrefix="vf"
                pairs={pairs}
                onPairs={setPairs}
                price={price}
                onPrice={setPrice}
                unit={unit}
                onUnit={setUnit}
                minStock={minStock}
                onMinStock={setMinStock}
                isTrackableLot={isTrackableLot}
                onTrackableLot={setIsTrackableLot}
              />

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Ảnh dòng (quy cách)</Label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setImageFile(f);
                    setImagePreview(f ? URL.createObjectURL(f) : null);
                  }}
                  className="block w-full text-sm text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary-foreground"
                />
                {imagePreview && (
                  <ZoomableImage
                    src={imagePreview}
                    alt="Xem trước"
                    className="mt-1.5 h-12 w-12 rounded-md border object-cover"
                  />
                )}
              </div>

              {/* Đặt mặc định — chỉ khi sửa 1 dòng có sẵn. */}
              {editing && (
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={wantDefault}
                    disabled={editing.isDefault}
                    onChange={(e) => setWantDefault(e.target.checked)}
                    className="size-4 accent-primary disabled:cursor-not-allowed"
                  />
                  {editing.isDefault
                    ? "Dòng này đang là mặc định (dùng làm ảnh đại diện của vật tư)"
                    : "Đặt dòng này làm mặc định (dùng làm ảnh đại diện của vật tư)"}
                </label>
              )}

              {/* Đánh dấu dòng là bộ lắp ráp */}
              <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={isKit}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setIsKit(next);
                    if (next) {
                      // Mặc định linh kiện hiện có định mức 1.
                      setKitQty((q) => {
                        const base: Record<string, string> = {};
                        for (const c of kitCandidates) base[c.id] = q[c.id] ?? "1";
                        return base;
                      });
                    } else {
                      setKitQty({});
                    }
                  }}
                  className="size-4 accent-primary"
                />
                Dòng này là Bộ (tồn tự tính theo linh kiện bên dưới)
              </label>

              {isKit && (
                <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Cấu tạo bộ — chọn linh kiện & số lượng trong 1 bộ</p>
                  {kitCandidates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Chưa có dòng linh kiện nào. Thêm các dòng linh kiện trước rồi quay lại đây đánh dấu dòng này là Bộ.
                    </p>
                  ) : (
                    kitCandidates.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.label}</span>
                        <span className="text-xs text-muted-foreground">trong 1 bộ:</span>
                        <Input
                          type="number"
                          min="0"
                          className="h-8 w-20"
                          value={kitQty[c.id] ?? ""}
                          onChange={(e) => setKitQty((q) => ({ ...q, [c.id]: e.target.value }))}
                        />
                        <span className="text-xs text-muted-foreground">(0 = không thuộc bộ)</span>
                      </div>
                    ))
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Khi xuất/bán lẻ 1 linh kiện, số bộ còn ráp được sẽ giảm tương ứng; tồn bộ = linh kiện ít nhất ÷
                    định mức.
                  </p>
                </div>
              )}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Đang lưu…" : editing ? "Lưu dòng" : "Thêm dòng"}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
