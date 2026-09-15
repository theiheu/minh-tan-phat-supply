"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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

type CreateMode = "le" | "quy-doi" | "quy-cach" | "bo";

const MODE_OPTIONS: { value: CreateMode; label: string; hint: string }[] = [
  { value: "le", label: "Lẻ (1 quy cách)", hint: "1 dòng tồn kho, không khai thuộc tính." },
  { value: "quy-doi", label: "Quy đổi đơn vị", hint: "VD 1 Thùng = 6 Hộp keo 550ml, tự động tính tồn." },
  { value: "quy-cach", label: "Nhiều quy cách", hint: "VD cùng vật tư có 10kg / 25kg độc lập." },
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

interface ConversionDraft {
  uid: string;
  unit: string;
  factor: string;
  price: string;
  spec: string;
}

function blankRow(): DraftRow {
  return { uid: uid(), attributes: [["", ""]], price: "", unit: "", minStock: "0", isTrackableLot: false };
}

function blankConversion(): ConversionDraft {
  return { uid: uid(), unit: "Thùng", factor: "6", price: "", spec: "" };
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

  // Field cho chế độ Quy đổi đơn vị (Đóng gói đa cấp).
  const [baseUnit, setBaseUnit] = useState("");
  const [baseSpec, setBaseSpec] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [baseMinStock, setBaseMinStock] = useState("0");
  const [baseTrackableLot, setBaseTrackableLot] = useState(false);
  const [conversions, setConversions] = useState<ConversionDraft[]>([blankConversion()]);

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
      setBaseUnit("");
      setBaseSpec("");
      setBasePrice("");
      setBaseMinStock("0");
      setBaseTrackableLot(false);
      setConversions([blankConversion()]);
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
    setBaseUnit("");
    setBaseSpec("");
    setBasePrice("");
    setBaseMinStock("0");
    setBaseTrackableLot(false);
    setConversions([blankConversion()]);
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

  function addConversionRow() {
    setConversions((arr) => [
      ...arr,
      { uid: uid(), unit: "Pallet", factor: "20", price: "", spec: "" },
    ]);
  }

  function removeConversionRow(uidRow: string) {
    if (conversions.length <= 1) {
      toast.error("Cần ít nhất 1 đơn vị quy đổi");
      return;
    }
    setConversions((arr) => arr.filter((c) => c.uid !== uidRow));
  }

  function updateConversionRow(uidRow: string, patch: Partial<ConversionDraft>) {
    setConversions((arr) => arr.map((c) => (c.uid === uidRow ? { ...c, ...patch } : c)));
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
    if (mode === "quy-doi") {
      if (!baseUnit.trim()) return "Nhập tên đơn vị cơ sở (VD: Hộp, ml, Chai, Cái)";
      if (conversions.length === 0) return "Cần ít nhất 1 đơn vị quy đổi";
      for (const [idx, conv] of conversions.entries()) {
        if (!conv.unit.trim()) return `Nhập tên đơn vị đóng gói #${idx + 1} (VD: Thùng)`;
        const factorNum = Number(conv.factor);
        if (isNaN(factorNum) || factorNum < 1) return `Tỷ lệ quy đổi #${idx + 1} phải là số nguyên ≥ 1`;
        if (conv.unit.trim().toLowerCase() === baseUnit.trim().toLowerCase()) {
          return `Đơn vị quy đổi "${conv.unit}" không được trùng với đơn vị cơ sở "${baseUnit}"`;
        }
      }
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

          if (mode === "quy-doi") {
            const baseAttr = baseSpec.trim() ? JSON.stringify({ "Quy cách": baseSpec.trim() }) : "{}";
            const baseVar = {
              attributes: baseAttr,
              price: basePrice === "" ? null : Number(basePrice),
              unit: baseUnit.trim(),
              minStock: Number(baseMinStock) || 0,
              isTrackableLot: baseTrackableLot,
              images: [] as string[],
            };

            const convVars = conversions.map((conv) => {
              const spec = conv.spec.trim()
                ? conv.spec.trim()
                : `1 ${conv.unit.trim()} = ${conv.factor} ${baseUnit.trim()}${baseSpec.trim() ? ` (${baseSpec.trim()})` : ""}`;
              return {
                attributes: JSON.stringify({ "Quy cách": spec }),
                price: conv.price === "" ? null : Number(conv.price),
                unit: conv.unit.trim(),
                minStock: 0,
                isTrackableLot: false,
                images: [] as string[],
              };
            });

            const variants = [baseVar, ...convVars];
            const unitConversion = {
              baseUnit: baseUnit.trim(),
              baseSpec: baseSpec.trim(),
              basePrice: basePrice === "" ? null : Number(basePrice),
              baseMinStock: Number(baseMinStock) || 0,
              baseTrackableLot,
              conversions: conversions.map((c) => ({
                unit: c.unit.trim(),
                factor: Number(c.factor) || 1,
                price: c.price === "" ? null : Number(c.price),
                spec: c.spec.trim(),
              })),
            };

            await createProduct({
              name: name.trim(),
              description,
              categoryId,
              options: "",
              images,
              variants,
              unitConversion,
            });
            toast.success("Đã tạo vật tư có quy đổi đơn vị");
          } else {
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa vật tư" : "Thêm vật tư"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cập nhật thông tin vật tư."
              : "Tạo vật tư lẻ, quy đổi đơn vị (thùng/hộp), nhiều quy cách hoặc bộ lắp ráp."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Loại vật tư (chỉ khi tạo) */}
          {!isEdit && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-xs font-semibold">Kiểu quản lý vật tư & đơn vị</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MODE_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => pickMode(m.value)}
                    className={`rounded-md border p-2.5 text-left text-sm transition-colors ${
                      mode === m.value
                        ? "border-primary bg-primary/10 font-medium text-primary shadow-xs"
                        : "hover:bg-accent"
                    }`}
                  >
                    <div className="font-semibold text-xs">{m.label}</div>
                    <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">{m.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tên vật tư</Label>
              <Input
                required
                placeholder="VD: Keo dán bạt, Thuốc sát trùng..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
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
              <Input
                placeholder="Mô tả công dụng, vị trí sử dụng..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
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

          {/* Tạo mới theo mode Lẻ */}
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

          {/* Tạo mới theo mode Quy đổi đơn vị */}
          {!isEdit && mode === "quy-doi" && (
            <div className="space-y-4 rounded-lg border p-3.5 bg-muted/20">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">1. Đơn vị cơ sở (Đơn vị nhỏ nhất để quản lý tồn kho)</p>
                <p className="text-[11px] text-muted-foreground">
                  Tồn kho thực tế trong kho chính sẽ được lưu và đếm theo đơn vị này (VD: Hộp, ml, Chai, Cái, Kg).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-md border bg-background p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tên đơn vị cơ sở *</Label>
                  <Input
                    placeholder="VD: Hộp, ml, Chai, Gói, Kg..."
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quy cách chi tiết / Thể tích (tùy chọn)</Label>
                  <Input
                    placeholder="VD: 550ml, 500g, 1 lít..."
                    value={baseSpec}
                    onChange={(e) => setBaseSpec(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Giá xuất lẻ (đ)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="đ"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tồn tối thiểu cảnh báo</Label>
                  <Input
                    type="number"
                    min="0"
                    value={baseMinStock}
                    onChange={(e) => setBaseMinStock(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 pt-1">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={baseTrackableLot}
                      onChange={(e) => setBaseTrackableLot(e.target.checked)}
                      className="size-4 accent-primary"
                    />
                    Theo dõi theo số lô & hạn sử dụng
                  </label>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">2. Đơn vị đóng gói quy đổi (Thùng, Kiện, Bao lớn...)</p>
                    <p className="text-[11px] text-muted-foreground">
                      Khi yêu cầu hoặc nhập kho theo đơn vị này, hệ thống sẽ tự động quy đổi ra đơn vị cơ sở.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addConversionRow}
                    className="h-7 text-xs"
                  >
                    + Thêm cấp đóng gói
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {conversions.map((conv, idx) => (
                    <div key={conv.uid} className="rounded-md border bg-background p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-primary">Cấp đóng gói #{idx + 1}</span>
                        {conversions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeConversionRow(conv.uid)}
                            className="text-destructive hover:bg-destructive/10"
                            aria-label="Xóa cấp đóng gói"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Tên đơn vị lớn *</Label>
                          <Input
                            placeholder="VD: Thùng, Bao, Can, Pallet..."
                            value={conv.unit}
                            onChange={(e) => updateConversionRow(conv.uid, { unit: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Tỷ lệ quy đổi *</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground shrink-0">1 {conv.unit || "đơn vị"} =</span>
                            <Input
                              type="number"
                              min="1"
                              className="w-20 font-semibold tabular-nums text-center"
                              placeholder="6"
                              value={conv.factor}
                              onChange={(e) => updateConversionRow(conv.uid, { factor: e.target.value })}
                            />
                            <span className="text-xs font-medium truncate">
                              {baseUnit || "Đơn vị cơ sở"}{baseSpec ? ` (${baseSpec})` : ""}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Giá theo đơn vị này (đ)</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="đ"
                            value={conv.price}
                            onChange={(e) => updateConversionRow(conv.uid, { price: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Quy cách / Ghi chú đóng gói (tùy chọn)</Label>
                          <Input
                            placeholder={`VD: ${conv.factor || "6"} ${baseUnit || "hộp"} / ${conv.unit || "thùng"}`}
                            value={conv.spec}
                            onChange={(e) => updateConversionRow(conv.uid, { spec: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live preview banner */}
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                <div className="font-semibold text-primary">💡 Xem trước công thức quy đổi:</div>
                <div className="text-foreground">
                  • <strong>Đơn vị cơ sở:</strong> 1 {baseUnit || "(chưa nhập)"} {baseSpec ? `(${baseSpec})` : ""} {basePrice ? `— Giá: ${Number(basePrice).toLocaleString("vi-VN")} đ` : ""}
                </div>
                {conversions.map((conv) => (
                  <div key={conv.uid} className="text-foreground">
                    • <strong>Đơn vị đóng gói:</strong> 1 {conv.unit || "(chưa nhập)"} = <strong>{conv.factor || "1"}</strong> {baseUnit || "(cơ sở)"} {baseSpec ? `(${baseSpec})` : ""} {conv.price ? `— Giá: ${Number(conv.price).toLocaleString("vi-VN")} đ` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tạo mới theo mode Nhiều quy cách / Bộ */}
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
                {rows.map((r, index) => {
                  const isCurrentKit = kitUid === r.uid;
                  return (
                    <div
                      key={r.uid}
                      className={`space-y-2 rounded-md border p-3 ${
                        isCurrentKit ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">Dòng #{index + 1}</span>
                          <span className="text-xs text-muted-foreground">— {rowPreview(r)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {mode === "bo" && (
                            <button
                              type="button"
                              onClick={() => setKitUid(isCurrentKit ? null : r.uid)}
                              className={`rounded px-2 py-0.5 text-xs font-medium border transition-colors ${
                                isCurrentKit
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/30 hover:bg-accent"
                              }`}
                            >
                              {isCurrentKit ? "★ Dòng Bộ (Lắp ráp)" : "Đặt làm Bộ"}
                            </button>
                          )}
                          {rows.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => removeRow(r.uid)}
                              aria-label="Xóa dòng"
                            >
                              ✕
                            </Button>
                          )}
                        </div>
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
                        onTrackableLot={(isTrackableLot) => setRow(r.uid, { isTrackableLot })}
                      />

                      {mode === "bo" && !isCurrentKit && kitUid && (
                        <div className="flex items-center gap-2 border-t pt-2 text-xs">
                          <Label className="text-xs text-muted-foreground">Định mức trong bộ:</Label>
                          <Input
                            type="number"
                            min="0"
                            className="h-7 w-20"
                            placeholder="0"
                            value={kitQty[r.uid] ?? ""}
                            onChange={(e) => kitQtyRow(r.uid, e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">{r.unit || "đơn vị"} / 1 bộ</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo vật tư"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
