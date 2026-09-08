"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { attributesToPairs, pairsToJson } from "@/lib/attributes";
import { formatVnd } from "@/lib/format";
import {
  createVariant,
  deleteVariant,
  getProductVariants,
  saveVariantComponents,
  setDefaultVariant,
  updateVariant,
} from "../actions";
import type { AdminProductRow, AdminVariantRow } from "../types";
import { VariantFields } from "./variant-fields";
import { ZoomableImage } from "@/components/image-lightbox";
import { MultiImagePicker } from "./multi-image-picker";

function variantMetaLine(v: AdminVariantRow): string | null {
  const parts = [
    v.price != null ? formatVnd(v.price) : null,
    v.minStock > 0 ? `Tồn tối thiểu ${v.minStock}` : null,
    v.unit ? `Đơn vị ${v.unit}` : null,
    v.isTrackableLot ? "Theo lô" : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

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
  const [variantImages, setVariantImages] = useState<string[]>([]);

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
    setVariantImages([]);
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
    setVariantImages(v.images ?? []);
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
        const input = {
          attributes: pairsToJson(pairs),
          price: price === "" ? null : Number(price),
          unit: unit.trim() || null,
          minStock: Number(minStock) || 0,
          isTrackableLot,
          images: variantImages,
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
    if (isKit) {
      if (!unit.trim()) return "Nhập đơn vị cho bộ (VD: Bộ, Thùng)";
      const chosen = kitQuantityInputs();
      if (chosen.length === 0) return "Bộ phải gồm ít nhất 1 linh kiện (nhập số lượng > 0)";
    }
    return null;
  }

  function kitLabel(label: string, components: { label: string; quantity: number }[]) {
    if (components.length === 0) return label;
    const summary = components.map((c) => `${c.label} ×${c.quantity}`).join(" + ");
    return `${label} [${summary}]`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quản lý quy cách / dòng tồn kho</DialogTitle>
          <DialogDescription>
            {product?.name ? `Vật tư: ${product.name}` : "Danh sách các dòng tồn kho của vật tư."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toolbar thêm nhanh */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Mỗi dòng có giá bán, tồn tối thiểu và tồn kho riêng.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={toggleAdd}>
                <Plus className="size-3.5" aria-hidden /> Thêm quy cách
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={toggleAddKit}>
                <Plus className="size-3.5" aria-hidden /> Thêm bộ lắp ráp
              </Button>
            </div>
          </div>

          {/* Danh sách dòng hiện có */}
          {loadState === "loading" && (
            <p className="py-6 text-center text-sm text-muted-foreground">Đang tải danh sách dòng…</p>
          )}

          {loadState === "error" && (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-destructive">
              <AlertTriangle className="size-5" aria-hidden />
              <span>{loadError}</span>
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
                {variants.map((v) => {
                  const meta = variantMetaLine(v);
                  return (
                    <li key={v.id} className="flex items-center gap-3 rounded-lg border p-3">
                      {v.images?.[0] ? (
                        <div className="relative shrink-0">
                          <ZoomableImage
                            src={v.images[0]}
                            images={v.images}
                            alt={v.label}
                            title={product?.name ? `${product.name} · ${v.label}` : v.label}
                            className="size-12 rounded-md border object-cover"
                          />
                          {v.images.length > 1 && (
                            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 py-0.2 text-[9px] font-semibold text-white pointer-events-none">
                              +{v.images.length - 1}
                            </span>
                          )}
                        </div>
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
                        {meta && (
                          <div className="text-xs break-words text-muted-foreground">
                            {meta}
                          </div>
                        )}
                        {v.isComposite && v.components.length > 0 && (
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            Gồm: {v.components.map((c) => `${c.label} ×${c.quantity}`).join(" · ")}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(v)}
                        >
                          Sửa
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => removeVariant(v)}
                          disabled={pending}
                        >
                          Xóa
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ))}

          {/* Form thêm/sửa dòng */}
          {showForm && (
            <form onSubmit={submit} className="space-y-3 rounded-lg border-2 border-primary/40 bg-accent/20 p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {editing ? `Sửa dòng: ${editing.label}` : isKit ? "Thêm bộ lắp ráp mới" : "Thêm quy cách mới"}
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                  Đóng form
                </Button>
              </div>

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

              <div className="space-y-1.5 sm:col-span-2">
                <MultiImagePicker
                  label="Ảnh quy cách"
                  images={variantImages}
                  onChange={setVariantImages}
                  disabled={pending}
                />
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
                  onChange={(e) => setIsKit(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Dòng này là Bộ lắp ráp (được ghép từ các linh kiện bán lẻ bên dưới)
              </label>

              {/* Cấu tạo bộ — danh sách linh kiện + số lượng */}
              {isKit && (
                <div className="space-y-2 rounded-md border bg-background p-3">
                  <p className="text-xs font-semibold">Cấu tạo bộ — số lượng từng linh kiện trong 1 Bộ:</p>
                  {kitCandidates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Chưa có dòng linh kiện nào khác để ghép vào bộ. Hãy tạo các quy cách linh kiện trước.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {kitCandidates.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate">
                            {c.label} {c.unit ? `(${c.unit})` : ""}
                          </span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              className="h-8 w-20 text-xs"
                              placeholder="0"
                              value={kitQty[c.id] ?? ""}
                              onChange={(e) => setKitQty((q) => ({ ...q, [c.id]: e.target.value }))}
                            />
                            <span className="w-12 text-muted-foreground">{c.unit || "đơn vị"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={pending}>
                  Hủy
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Đang lưu…" : editing ? "Cập nhật" : "Lưu dòng"}
                </Button>
              </div>
            </form>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
