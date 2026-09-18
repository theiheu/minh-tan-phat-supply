"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Package,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MultiImagePicker } from "@/features/products/components/multi-image-picker";
import { SkuSelector } from "@/features/catalog/components/sku-selector";
import { createCompleteProduct } from "../../actions";
import type { BomComponentInput } from "../../actions";
import type { CatalogUnit, SkuSelectOption } from "../../domain/types";
import { availableTransactionUnits, initialBaseUnitId, transactionUomCode, validateTransactionUomDrafts } from "../../domain/uom";

const STEPS = [
  { id: "info", label: "Thông tin chung", icon: Package },
  { id: "sku", label: "SKU & Quy cách (3 Trục)", icon: Boxes },
  { id: "bom", label: "Bộ lắp ráp (BOM)", icon: Wrench },
  { id: "uom", label: "Đơn vị & Quy đổi", icon: Scale },
  { id: "review", label: "Rà soát & Kích hoạt", icon: Sparkles },
];

const PRESETS: Array<{ label: string; axes: string[] }> = [
  { label: "Bạc đạn / Vòng bi", axes: ["Hãng sản xuất", "Mã vòng bi", "Loại nắp"] },
  { label: "Bu lông / Ốc vít", axes: ["Chất liệu", "Đường kính", "Chiều dài"] },
  { label: "Ống nước / Cáp điện", axes: ["Quy cách", "Độ dày"] },
  { label: "Điện / Khí nén", axes: ["Hãng sản xuất", "Thông số / Công suất"] },
];

export function CatalogDraftWorkflow({
  initialDraft: _initialDraft,
  units,
  categories,
}: {
  initialDraft: { id: string; revision: number; payload: Record<string, unknown> };
  units: CatalogUnit[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Form State
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [searchKeywords, setSearchKeywords] = useState("");

  // Mode: single SKU vs multi SKU
  const [isMultiSku, setIsMultiSku] = useState(false);

  // Option Axes (Tối đa 3 trục phân cấp, VD: Hãng sản xuất -> Mã vòng bi -> Loại nắp)
  const [optionAxes, setOptionAxes] = useState<string[]>(["Hãng sản xuất", "Mã quy cách"]);

  // Single SKU fields
  const [baseUnitId, setBaseUnitId] = useState(initialBaseUnitId);
  const [minStock, setMinStock] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [trackingPolicy, setTrackingPolicy] = useState<"none" | "lot" | "serial">("none");

  // Multi SKU items
  const [multiSkus, setMultiSkus] = useState<
    Array<{
      id: string;
      axisValues: Record<string, string>;
      skuCode: string;
      baseUnitId: string;
      minStock: number;
      price: number;
      trackingPolicy: "none" | "lot" | "serial";
      inventoryPolicy: "normal" | "virtual_kit" | "stocked_assembly";
      images: string[];
      bomComponents: Array<{
        id: string;
        componentSkuId: string;
        componentLabel: string;
        componentSkuCode: string;
        baseQuantity: number;
      }>;
    }>
  >([
    {
      id: "sku-1",
      axisValues: { "Hãng sản xuất": "SKF", "Mã quy cách": "6203" },
      skuCode: "",
      baseUnitId: initialBaseUnitId(),
      minStock: 0,
      price: 0,
      trackingPolicy: "none",
      inventoryPolicy: "normal",
      images: [],
      bomComponents: [],
    },
    {
      id: "sku-2",
      axisValues: { "Hãng sản xuất": "Koyo", "Mã quy cách": "6203" },
      skuCode: "",
      baseUnitId: initialBaseUnitId(),
      minStock: 0,
      price: 0,
      trackingPolicy: "none",
      inventoryPolicy: "normal",
      images: [],
      bomComponents: [],
    },
  ]);

  // Transaction UOMs (Packaging conversions)
  const [transactionUoms, setTransactionUoms] = useState<
    Array<{
      id: string;
      unitId: string;
      code: string;
      displayName: string;
      factorToBase: number;
      barcode: string;
    }>
  >([]);

  // Inventory policy — dùng khi single SKU; multi-SKU mỗi dòng có riêng
  const [inventoryPolicy, setInventoryPolicy] = useState<"normal" | "virtual_kit" | "stocked_assembly">("normal");

  // BOM components — chỉ dùng khi inventoryPolicy != "normal" (single SKU)
  // Multi-SKU: mỗi SKU có mảng bomComponents riêng (lưu trong multiSkus[].bomComponents)
  const [bomComponents, setBomComponents] = useState<
    Array<{
      id: string;
      componentSkuId: string;
      componentLabel: string;
      componentSkuCode: string;
      baseQuantity: number;
    }>
  >([]);

  // Axes helpers
  function addAxis() {
    if (optionAxes.length >= 3) {
      toast.error("Hệ thống hỗ trợ tối đa 3 trục thuộc tính phân cấp.");
      return;
    }
    const newAxisName = "Thuộc tính " + (optionAxes.length + 1);
    setOptionAxes([...optionAxes, newAxisName]);
  }

  function removeAxis(index: number) {
    if (optionAxes.length <= 1) {
      toast.error("Cần ít nhất 1 trục thuộc tính để phân loại quy cách.");
      return;
    }
    const removedAxis = optionAxes[index];
    const nextAxes = optionAxes.filter((_, i) => i !== index);
    setOptionAxes(nextAxes);

    // Xóa key của trục bị xóa khỏi các dòng SKU
    setMultiSkus((prev) =>
      prev.map((s) => {
        const nextVals = { ...s.axisValues };
        delete nextVals[removedAxis];
        return { ...s, axisValues: nextVals };
      })
    );
  }

  function applyPreset(presetAxes: string[]) {
    setOptionAxes(presetAxes);
    setMultiSkus((prev) =>
      prev.map((s) => {
        const newVals: Record<string, string> = {};
        for (const [idx, axis] of presetAxes.entries()) {
          const oldVal = Object.values(s.axisValues)[idx] || "";
          newVals[axis] = oldVal;
        }
        return { ...s, axisValues: newVals };
      })
    );
    toast.success("Đã áp dụng mẫu trục: " + presetAxes.join(" ➔ "));
  }

  // Helpers for BOM
  function addBomComponent(skuOpt: SkuSelectOption) {
    setBomComponents((prev) => [
      ...prev,
      {
        id: "bom-" + Date.now(),
        componentSkuId: skuOpt.skuId,
        componentLabel: skuOpt.productName + (skuOpt.summary && skuOpt.summary !== "SKU" ? " · " + skuOpt.summary : ""),
        componentSkuCode: skuOpt.skuCode,
        baseQuantity: 1,
      },
    ]);
  }

  function removeBomComponent(id: string) {
    setBomComponents((prev) => prev.filter((c) => c.id !== id));
  }

  function addMultiSkuBomComponent(skuId: string, skuOpt: SkuSelectOption) {
    setMultiSkus((prev) =>
      prev.map((s) =>
        s.id === skuId
          ? {
              ...s,
              bomComponents: [
                ...s.bomComponents,
                {
                  id: "bom-" + Date.now(),
                  componentSkuId: skuOpt.skuId,
                  componentLabel: skuOpt.productName + (skuOpt.summary && skuOpt.summary !== "SKU" ? " · " + skuOpt.summary : ""),
                  componentSkuCode: skuOpt.skuCode,
                  baseQuantity: 1,
                },
              ],
            }
          : s
      )
    );
  }

  function removeMultiSkuBomComponent(skuId: string, compId: string) {
    setMultiSkus((prev) =>
      prev.map((s) =>
        s.id === skuId ? { ...s, bomComponents: s.bomComponents.filter((c) => c.id !== compId) } : s
      )
    );
  }

  // Validation
  function validateStep(stepIdx: number): boolean {
    if (stepIdx === 0) {
      if (!name.trim()) {
        toast.error("Vui lòng nhập tên vật tư");
        return false;
      }
    } else if (stepIdx === 1) {
      if (!isMultiSku) {
        if (!baseUnitId.trim()) {
          toast.error("Vui lòng chọn đơn vị cơ sở");
          return false;
        }
      } else {
        // Validate option axes
        if (optionAxes.length === 0) {
          toast.error("Vui lòng khai báo ít nhất 1 trục thuộc tính");
          return false;
        }
        for (const [i, a] of optionAxes.entries()) {
          if (!a.trim()) {
            toast.error("Vui lòng nhập tên cho Trục #" + (i + 1));
            return false;
          }
        }

        if (multiSkus.length === 0) {
          toast.error("Vui lòng thêm ít nhất 1 quy cách");
          return false;
        }
        for (const [i, s] of multiSkus.entries()) {
          for (const axis of optionAxes) {
            const val = s.axisValues[axis];
            if (!val || !val.trim()) {
              toast.error("Quy cách #" + (i + 1) + " còn thiếu giá trị '" + axis + "'");
              return false;
            }
          }
          if (!s.baseUnitId.trim()) {
            toast.error("Vui lòng chọn đơn vị cơ sở cho quy cách #" + (i + 1));
            return false;
          }
        }
      }
    } else if (stepIdx === 2) {
      // BOM step validation
      if (!isMultiSku) {
        if ((inventoryPolicy === "virtual_kit" || inventoryPolicy === "stocked_assembly") && bomComponents.length === 0) {
          toast.error("Bộ lắp ráp phải có ít nhất 1 linh kiện");
          return false;
        }
      } else {
        for (const [i, s] of multiSkus.entries()) {
          if ((s.inventoryPolicy === "virtual_kit" || s.inventoryPolicy === "stocked_assembly") && s.bomComponents.length === 0) {
            toast.error("Quy cách #" + (i + 1) + " được khai báo là bộ lắp ráp nhưng chưa có linh kiện");
            return false;
          }
        }
      }
    }
    return true;
  }

  function handleNext() {
    if (!validateStep(currentStepIdx)) return;
    if (currentStepIdx < STEPS.length - 1) {
      setCurrentStepIdx((c) => c + 1);
    }
  }

  function handlePrev() {
    if (currentStepIdx > 0) setCurrentStepIdx((c) => c - 1);
  }

  // Add Multi SKU row
  function addSkuRow() {
    const defaultVals: Record<string, string> = {};
    for (const axis of optionAxes) {
      defaultVals[axis] = "";
    }
    setMultiSkus((prev) => [
      ...prev,
      {
        id: "sku-" + Date.now(),
        axisValues: defaultVals,
        skuCode: "",
        baseUnitId: baseUnitId || initialBaseUnitId(),
        minStock: 0,
        price: 0,
        trackingPolicy: "none",
        inventoryPolicy: "normal",
        images: [],
        bomComponents: [],
      },
    ]);
  }

  function removeSkuRow(id: string) {
    if (multiSkus.length <= 1) {
      toast.error("Phải có ít nhất một quy cách.");
      return;
    }
    setMultiSkus((prev) => prev.filter((s) => s.id !== id));
  }

  // Add Packaging UOM row
  function addUomRow() {
    if (!canConfigureSharedConversions) {
      toast.error("Hãy chọn cùng một đơn vị cơ sở cho các SKU trước khi thêm quy đổi");
      return;
    }
    const selectedUnitIds = transactionUoms.map((uom) => uom.unitId).filter(Boolean);
    const nextUnit = availableTransactionUnits(units, effectiveBaseUnitId, selectedUnitIds)[0];
    if (!nextUnit) {
      toast.error("Không còn đơn vị giao dịch nào để thêm");
      return;
    }
    setTransactionUoms((prev) => [
      ...prev,
      {
        id: "uom-" + Date.now(),
        unitId: nextUnit.id,
        code: transactionUomCode(nextUnit),
        displayName: nextUnit.name,
        factorToBase: 1,
        barcode: "",
      },
    ]);
  }

  function removeUomRow(id: string) {
    setTransactionUoms((prev) => prev.filter((u) => u.id !== id));
  }

  // Submit & Save Complete Product
  async function handleActivate() {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) return;

    const conversionBaseUnitIds = isMultiSku
      ? Array.from(new Set(multiSkus.map((sku) => sku.baseUnitId)))
      : [baseUnitId];
    if (transactionUoms.length > 0 && conversionBaseUnitIds.length !== 1) {
      toast.error("Các SKU phải dùng cùng đơn vị cơ sở để áp dụng chung bảng quy đổi");
      return;
    }
    const conversionBaseUnitId = conversionBaseUnitIds[0] ?? "";
    const conversionError = validateTransactionUomDrafts(transactionUoms, units, conversionBaseUnitId);
    if (conversionError) {
      toast.error(conversionError);
      return;
    }

    startTransition(async () => {
      try {
        const keywordsArray = searchKeywords
          .split(",")
          .map((k: string) => k.trim())
          .filter(Boolean);

        const skusPayload = isMultiSku
          ? multiSkus.map((s, idx) => {
              const isAssembly = s.inventoryPolicy === "virtual_kit" || s.inventoryPolicy === "stocked_assembly";
              return {
                skuCode: undefined,
                baseUnitId: s.baseUnitId,
                minStock: Number(s.minStock) || 0,
                price: Number(s.price) || null,
                trackingPolicy: s.trackingPolicy,
                inventoryPolicy: s.inventoryPolicy,
                isDefault: idx === 0,
                images: s.images && s.images.length > 0 ? s.images : (images.length > 0 ? images : []),
                attributes: s.axisValues,
                attributeValues: optionAxes.map((a) => ({ name: a, value: s.axisValues[a] || "" })),
                transactionUoms,
                bomComponents: isAssembly
                  ? s.bomComponents.map((c): BomComponentInput => ({ componentSkuId: c.componentSkuId, baseQuantity: c.baseQuantity }))
                  : [],
              };
            })
          : [
              {
                skuCode: undefined,
                baseUnitId,
                minStock: Number(minStock) || 0,
                price: Number(price) || null,
                trackingPolicy,
                inventoryPolicy,
                isDefault: true,
                images: images.length > 0 ? images : [],
                transactionUoms,
                bomComponents: (inventoryPolicy === "virtual_kit" || inventoryPolicy === "stocked_assembly")
                  ? bomComponents.map((c): BomComponentInput => ({ componentSkuId: c.componentSkuId, baseQuantity: c.baseQuantity }))
                  : [],
              },
            ];

        await createCompleteProduct({
          name: name.trim(),
          categoryId: categoryId || null,
          description: description.trim() || null,
          options: isMultiSku ? optionAxes : [],
          images,
          searchKeywords: keywordsArray,
          skus: skusPayload,
        });

        toast.success("Đã tạo và kích hoạt vật tư '" + name + "' thành công!");
        router.push("/admin/products");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo vật tư thất bại");
      }
    });
  }

  const effectiveBaseUnitId = isMultiSku ? multiSkus[0]?.baseUnitId ?? "" : baseUnitId;
  const selectedBaseUnit = units.find((unit) => unit.id === effectiveBaseUnitId);
  const conversionBaseUnitIds = isMultiSku
    ? Array.from(new Set(multiSkus.map((sku) => sku.baseUnitId).filter(Boolean)))
    : baseUnitId ? [baseUnitId] : [];
  const canConfigureSharedConversions = conversionBaseUnitIds.length === 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Step Indicator */}
      <ol className="flex items-center w-full text-sm font-medium text-center text-muted-foreground overflow-x-auto pb-2 flex-nowrap shrink-0 border-b">
        {STEPS.map((step, idx) => {
          const isActive = idx === currentStepIdx;
          const isPast = idx < currentStepIdx;
          const Icon = step.icon;
          return (
            <li
              key={step.id}
              className={"flex md:w-full items-center cursor-pointer transition-colors " + (isActive ? "text-primary font-bold" : isPast ? "text-foreground" : "text-muted-foreground/60")}
              onClick={() => {
                if (idx < currentStepIdx || validateStep(currentStepIdx)) {
                  setCurrentStepIdx(idx);
                }
              }}
            >
              <span
                className={"flex items-center justify-center size-7 rounded-full shrink-0 mr-2 text-xs border transition-all " + (isActive ? "border-primary bg-primary text-primary-foreground shadow-sm" : isPast ? "border-primary bg-primary/10 text-primary" : "border-muted-foreground/30 bg-muted")}
              >
                {isPast ? <Check className="size-4" /> : <Icon className="size-3.5" />}
              </span>
              <span className="whitespace-nowrap mr-2">{step.label}</span>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="size-4 mx-2 text-muted-foreground/40 shrink-0" />
              )}
            </li>
          );
        })}
      </ol>

      {/* Step 1: Thông tin chung */}
      {currentStepIdx === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Thông tin cơ bản</CardTitle>
            <CardDescription>Nhập tên gọi, danh mục phân loại và hình ảnh nhận diện vật tư.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="product-name" className="after:content-['*'] after:ml-0.5 after:text-destructive font-medium">
                Tên vật tư
              </Label>
              <Input
                id="product-name"
                placeholder="VD: Bạc đạn công nghiệp / Bu lông lục giác / Cáp điện"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Loại vật tư — lựa chọn nổi bật ngay bước đầu */}
            <div className="space-y-2">
              <Label className="font-semibold">Loại vật tư:</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => { setInventoryPolicy("normal"); setBomComponents([]); }}
                  className={"flex items-start gap-3 p-3.5 rounded-lg border text-left cursor-pointer transition-all " + (inventoryPolicy === "normal" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}
                >
                  <div className={"size-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 " + (inventoryPolicy === "normal" ? "border-primary bg-primary" : "border-muted-foreground/40")}>
                    {inventoryPolicy === "normal" && <Check className="size-2.5 text-primary-foreground" />}
                  </div>
                  <div>
                    <span className="font-medium block text-sm">Vật tư thông thường</span>
                    <span className="text-xs text-muted-foreground">Tồn kho độc lập. Dùng cho linh kiện, vật tư rời, hàng hóa.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInventoryPolicy("virtual_kit")}
                  className={"flex items-start gap-3 p-3.5 rounded-lg border text-left cursor-pointer transition-all " + (inventoryPolicy === "virtual_kit" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}
                >
                  <div className={"size-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 " + (inventoryPolicy === "virtual_kit" ? "border-primary bg-primary" : "border-muted-foreground/40")}>
                    {inventoryPolicy === "virtual_kit" && <Check className="size-2.5 text-primary-foreground" />}
                  </div>
                  <div>
                    <span className="font-medium block text-sm flex items-center gap-1.5"><Wrench className="size-3.5 inline text-primary" /> Bộ lắp ráp ảo</span>
                    <span className="text-xs text-muted-foreground">Tồn tự tính từ linh kiện (Virtual Kit). Không nhập kho bộ trực tiếp.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInventoryPolicy("stocked_assembly")}
                  className={"flex items-start gap-3 p-3.5 rounded-lg border text-left cursor-pointer transition-all " + (inventoryPolicy === "stocked_assembly" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}
                >
                  <div className={"size-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 " + (inventoryPolicy === "stocked_assembly" ? "border-primary bg-primary" : "border-muted-foreground/40")}>
                    {inventoryPolicy === "stocked_assembly" && <Check className="size-2.5 text-primary-foreground" />}
                  </div>
                  <div>
                    <span className="font-medium block text-sm flex items-center gap-1.5"><Wrench className="size-3.5 inline text-primary" /> Bộ lắp ráp có tồn</span>
                    <span className="text-xs text-muted-foreground">Tồn kho riêng cho thành phẩm. Cần lệnh ráp/tháo để điều chỉnh tồn.</span>
                  </div>
                </button>
              </div>
              {inventoryPolicy !== "normal" && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <Wrench className="size-3.5 shrink-0" />
                  Khai báo linh kiện BOM ở bước 3 — Bộ lắp ráp.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category-select">Danh mục phân loại</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="category-select">
                    <SelectValue placeholder="-- Chọn danh mục --" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="search-keywords">Từ khóa tìm kiếm (cách nhau bằng dấu phẩy)</Label>
                <Input
                  id="search-keywords"
                  placeholder="bac dan, vong bi, koyo, skf, 6203"
                  value={searchKeywords}
                  onChange={(e) => setSearchKeywords(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-description">Mô tả / Thông số kỹ thuật</Label>
              <Textarea
                id="product-description"
                placeholder="Nhập thông số kỹ thuật, ứng dụng chuồng nuôi hoặc ghi chú bảo quản..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Hình ảnh vật tư</Label>
              <MultiImagePicker
                images={images}
                onChange={setImages}
                disabled={pending}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: SKU & Quy cách (Hỗ trợ 1-3 Trục Phân Cấp) */}
      {currentStepIdx === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Định nghĩa SKU & Cấu trúc Quy cách (Tối đa 3 Trục)</CardTitle>
            <CardDescription>
              Thiết lập các trục phân loại (VD: Hãng sản xuất ➔ Mã vòng bi ➔ Loại nắp) để hệ thống tự động sinh bộ chọn đa tầng.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="font-semibold">Kiểu quy cách vật tư:</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsMultiSku(false)}
                  className={"flex items-start gap-3 p-4 rounded-lg border text-left cursor-pointer transition-all " + (!isMultiSku ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}
                >
                  <div
                    className={"size-4 rounded-full border mt-1 flex items-center justify-center shrink-0 " + (!isMultiSku ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}
                  >
                    {!isMultiSku && <Check className="size-2.5" />}
                  </div>
                  <div>
                    <span className="font-medium block">Vật tư đơn nhất (1 SKU duy nhất)</span>
                    <span className="text-xs text-muted-foreground">
                      Dành cho vật tư chỉ có 1 kích cỡ tiêu chuẩn (VD: Quạt hút 1.1kW, Thang nhôm).
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMultiSku(true)}
                  className={"flex items-start gap-3 p-4 rounded-lg border text-left cursor-pointer transition-all " + (isMultiSku ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}
                >
                  <div
                    className={"size-4 rounded-full border mt-1 flex items-center justify-center shrink-0 " + (isMultiSku ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}
                  >
                    {isMultiSku && <Check className="size-2.5" />}
                  </div>
                  <div>
                    <span className="font-medium block">Nhiều quy cách / Biến thể đa tầng (Multi-SKU)</span>
                    <span className="text-xs text-muted-foreground">
                      Phân cấp theo Hãng, Kích cỡ, Mã số (VD: Bạc đạn SKF/Koyo 6203, Bu lông M6x20, M8x30).
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Single SKU Form */}
            {!isMultiSku ? (
              <div className="p-4 rounded-lg border bg-muted/20 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="base-unit" className="after:content-['*'] after:ml-0.5 after:text-destructive">
                      Đơn vị tính cơ bản
                    </Label>
                    <Select value={baseUnitId} onValueChange={setBaseUnitId}>
                      <SelectTrigger id="base-unit">
                        <SelectValue placeholder="Chọn đơn vị dùng để ghi tồn kho" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Mọi số lượng tồn kho được lưu theo đơn vị này. Ví dụ: chọn “Cái” nếu kho đếm từng cái.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="min-stock">Tồn kho tối thiểu cảnh báo</Label>
                    <Input
                      id="min-stock"
                      type="number"
                      min="0"
                      value={minStock}
                      onChange={(e) => setMinStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-price">Đơn giá tham khảo (VNĐ)</Label>
                    <Input
                      id="ref-price"
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0 ₫"
                      value={price || ""}
                      onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tracking-policy">Chính sách quản lý định danh</Label>
                    <Select
                      value={trackingPolicy}
                      onValueChange={(v: "none" | "lot" | "serial") => setTrackingPolicy(v)}
                    >
                      <SelectTrigger id="tracking-policy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Không theo dõi riêng (Thông thường)</SelectItem>
                        <SelectItem value="lot">Quản lý theo Số Lô & Hạn sử dụng (FEFO)</SelectItem>
                        <SelectItem value="serial">Quản lý theo Số Serial / Mã thiết bị</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Nhắc loại vật tư đã chọn ở bước 1 */}
                {inventoryPolicy !== "normal" && (
                  <div className="sm:col-span-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
                    <Wrench className="size-3.5 shrink-0" />
                    <span>Loại vật tư: <strong>{inventoryPolicy === "virtual_kit" ? "Bộ lắp ráp ảo (Virtual Kit)" : "Bộ lắp ráp có tồn kho riêng (Stocked Assembly)"}</strong> — khai báo linh kiện ở bước Bộ lắp ráp (BOM).</span>
                  </div>
                )}
              </div>
            ) : (
              /* Multi SKU: 3 Option Axes + Matrix Table */
              <div className="space-y-6">
                {/* 1. Thiết lập các trục thuộc tính (1-3 trục) */}
                <div className="p-4 rounded-lg border bg-primary/5 border-primary/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Boxes className="size-4 text-primary" />
                        Thiết lập các trục phân cấp ({optionAxes.length}/3 trục):
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Thứ tự các trục sẽ quyết định thứ tự hàng nút bấm khi người dùng chọn vật tư.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addAxis}
                        disabled={optionAxes.length >= 3}
                        className="h-7 text-xs bg-background"
                      >
                        <Plus className="size-3.5 mr-1" /> Thêm trục ({optionAxes.length}/3)
                      </Button>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-muted-foreground font-medium mr-1">Mẫu gợi ý:</span>
                    {PRESETS.map((p) => (
                      <button
                        type="button"
                        key={p.label}
                        onClick={() => applyPreset(p.axes)}
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium border bg-background hover:bg-muted text-foreground transition-all"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Axes Input List */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {optionAxes.map((axis, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-background p-2 rounded-md border shadow-xs">
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          Trục {i + 1}
                        </Badge>
                        <Input
                          value={axis}
                          placeholder={"Tên trục #" + (i + 1)}
                          className="h-7 text-xs font-semibold"
                          onChange={(e) => {
                            const val = e.target.value;
                            const next = [...optionAxes];
                            next[i] = val;
                            setOptionAxes(next);
                          }}
                        />
                        {optionAxes.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeAxis(i)}
                          >
                            <X className="size-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Bảng nhập từng dòng quy cách */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-sm">
                      Danh sách biến thể ({multiSkus.length} quy cách):
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={addSkuRow} className="h-8">
                      <Plus className="size-4 mr-1.5" /> Thêm dòng quy cách
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {multiSkus.map((s, idx) => {
                      const labelPreview = optionAxes.map((a) => s.axisValues[a] || "").filter(Boolean).join(" · ") || "Chưa nhập";

                      return (
                        <div
                          key={s.id}
                          className="flex flex-col gap-3 p-3.5 rounded-lg border bg-muted/20 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                #{idx + 1}
                              </Badge>
                              <span className="text-xs font-bold text-foreground">
                                {labelPreview}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 ml-auto">
                              <Select
                                value={s.inventoryPolicy}
                                onValueChange={(v: "normal" | "virtual_kit" | "stocked_assembly") => {
                                  setMultiSkus((prev) =>
                                    prev.map((item) =>
                                      item.id === s.id
                                        ? { ...item, inventoryPolicy: v, bomComponents: v === "normal" ? [] : item.bomComponents }
                                        : item
                                    )
                                  );
                                }}
                              >
                                <SelectTrigger className="h-6 text-[11px] w-auto min-w-[120px] gap-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="normal">Thông thường</SelectItem>
                                  <SelectItem value="virtual_kit">🔧 Bộ ảo (Virtual Kit)</SelectItem>
                                  <SelectItem value="stocked_assembly">🔧 Bộ có tồn kho riêng</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => removeSkuRow(s.id)}
                                disabled={multiSkus.length <= 1}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Dynamic Inputs per Axis */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {optionAxes.map((axis) => (
                              <div key={axis} className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">{axis}:</Label>
                                <Input
                                  placeholder={"Nhập " + axis.toLowerCase() + "..."}
                                  value={s.axisValues[axis] || ""}
                                  className="h-8 text-xs font-medium"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setMultiSkus((prev) =>
                                      prev.map((item) =>
                                        item.id === s.id
                                          ? { ...item, axisValues: { ...item.axisValues, [axis]: val } }
                                          : item
                                      )
                                    );
                                  }}
                                />
                              </div>
                            ))}
                          </div>

                          {/* Secondary info: Unit, MinStock, Price, InventoryPolicy */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/40">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Đơn vị tính:</Label>
                              <Select
                                value={s.baseUnitId}
                                onValueChange={(baseUnitId) => {
                                  setMultiSkus((prev) =>
                                    prev.map((item) => (item.id === s.id ? { ...item, baseUnitId } : item))
                                  );
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Chọn đơn vị" />
                                </SelectTrigger>
                                <SelectContent>
                                  {units.map((unit) => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                      {unit.name} ({unit.symbol})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Tồn an toàn tối thiểu:</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                className="h-7 text-xs tabular-nums text-center"
                                value={s.minStock || ""}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setMultiSkus((prev) =>
                                    prev.map((item) => (item.id === s.id ? { ...item, minStock: val } : item))
                                  );
                                }}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Đơn giá tham khảo (₫):</Label>
                              <Input
                                type="number"
                                min="0"
                                step="1000"
                                placeholder="0 ₫"
                                className="h-7 text-xs tabular-nums"
                                value={s.price || ""}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setMultiSkus((prev) =>
                                    prev.map((item) => (item.id === s.id ? { ...item, price: val } : item))
                                  );
                                }}
                              />
                            </div>
                          </div>

                          {/* Hình ảnh riêng cho biến thể này */}
                          <div className="space-y-1.5 pt-2 border-t border-border/40">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                <ImagePlus className="size-3.5 text-primary" />
                                Hình ảnh riêng cho quy cách này ({s.images?.length || 0} ảnh):
                              </Label>
                              <span className="text-[10px] text-muted-foreground">
                                (Nếu để trống, sẽ dùng ảnh chung của vật tư)
                              </span>
                            </div>
                            <MultiImagePicker
                              images={s.images || []}
                              onChange={(newImgs) => {
                                setMultiSkus((prev) =>
                                  prev.map((item) => (item.id === s.id ? { ...item, images: newImgs } : item))
                                );
                              }}
                              disabled={pending}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Bộ lắp ráp (BOM) */}
      {currentStepIdx === 2 && (() => {
        // Xác định có SKU nào là bộ lắp ráp không
        const hasSingleAssembly = !isMultiSku && (inventoryPolicy === "virtual_kit" || inventoryPolicy === "stocked_assembly");
        const assemblyMultiSkus = isMultiSku ? multiSkus.filter((s) => s.inventoryPolicy === "virtual_kit" || s.inventoryPolicy === "stocked_assembly") : [];
        const hasAnyAssembly = hasSingleAssembly || assemblyMultiSkus.length > 0;

        return (
          <Card>
            <CardHeader>
              <CardTitle>3. Khai báo Bộ lắp ráp (BOM)</CardTitle>
              <CardDescription>
                Xác định các linh kiện cấu thành bộ. Tồn kho bộ sẽ tự tính dựa trên số lượng linh kiện hiện có (Virtual Kit)
                hoặc được quản lý tồn riêng (Stocked Assembly).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!hasAnyAssembly ? (
                <div className="py-8 border rounded-lg border-dashed bg-muted/10 space-y-4 px-6 text-center">
                  <Wrench className="size-8 text-muted-foreground/50 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Chưa chọn loại bộ lắp ráp</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vật tư này chưa được đặt là bộ lắp ráp. Chọn loại ngay bên dưới hoặc quay lại Bước 1.
                    </p>
                  </div>
                  {!isMultiSku && (
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setInventoryPolicy("virtual_kit")}
                        className="gap-1.5"
                      >
                        <Wrench className="size-3.5" /> Bộ lắp ráp ảo (Virtual Kit)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setInventoryPolicy("stocked_assembly")}
                        className="gap-1.5"
                      >
                        <Wrench className="size-3.5" /> Bộ có tồn kho riêng (Stocked Assembly)
                      </Button>
                    </div>
                  )}
                  {isMultiSku && (
                    <p className="text-xs text-muted-foreground">
                      Với Multi-SKU: quay lại Bước 2 và chọn loại vật tư trong từng dòng quy cách.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Single SKU BOM */}
                  {hasSingleAssembly && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="font-semibold">
                            Linh kiện BOM ({bomComponents.length} linh kiện):
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Chính sách: <Badge variant="outline" className="text-xs">{inventoryPolicy === "virtual_kit" ? "Virtual Kit — tồn tính từ linh kiện" : "Stocked Assembly — tồn kho riêng"}</Badge>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {bomComponents.map((comp) => (
                          <div key={comp.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{comp.componentLabel}</p>
                              <p className="text-xs text-muted-foreground font-mono">{comp.componentSkuCode}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">SL/bộ:</Label>
                              <Input
                                type="number"
                                min="1"
                                className="h-7 w-20 text-xs text-center tabular-nums"
                                value={comp.baseQuantity}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  setBomComponents((prev) =>
                                    prev.map((c) => (c.id === comp.id ? { ...c, baseQuantity: val } : c))
                                  );
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                onClick={() => removeBomComponent(comp.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 rounded-lg border border-dashed bg-muted/10 space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">Thêm linh kiện:</Label>
                        <SkuSelector
                          excludeSkuIds={bomComponents.map((c) => c.componentSkuId)}
                          onSelect={addBomComponent}
                        />
                      </div>
                    </div>
                  )}

                  {/* Multi-SKU BOM — each assembly SKU has its own BOM */}
                  {assemblyMultiSkus.map((s, idx) => {
                    const labelPreview = optionAxes.map((a) => s.axisValues[a] || "").filter(Boolean).join(" · ") || "Quy cách #" + (multiSkus.indexOf(s) + 1);
                    return (
                      <div key={s.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">#{multiSkus.indexOf(s) + 1}</Badge>
                          <span className="font-semibold text-sm">{labelPreview}</span>
                          <Badge variant="secondary" className="text-xs">{s.inventoryPolicy === "virtual_kit" ? "Virtual Kit" : "Stocked Assembly"}</Badge>
                        </div>

                        <div className="space-y-2">
                          {s.bomComponents.map((comp) => (
                            <div key={comp.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{comp.componentLabel}</p>
                                <p className="text-xs text-muted-foreground font-mono">{comp.componentSkuCode}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">SL/bộ:</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  className="h-7 w-20 text-xs text-center tabular-nums"
                                  value={comp.baseQuantity}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                    setMultiSkus((prev) =>
                                      prev.map((item) =>
                                        item.id === s.id
                                          ? {
                                              ...item,
                                              bomComponents: item.bomComponents.map((c) =>
                                                c.id === comp.id ? { ...c, baseQuantity: val } : c
                                              ),
                                            }
                                          : item
                                      )
                                    );
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeMultiSkuBomComponent(s.id, comp.id)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="p-3 rounded-lg border border-dashed bg-muted/10 space-y-2">
                          <Label className="text-xs font-semibold text-muted-foreground">Thêm linh kiện cho bộ này:</Label>
                          <SkuSelector
                            excludeSkuIds={s.bomComponents.map((c) => c.componentSkuId)}
                            onSelect={(opt) => addMultiSkuBomComponent(s.id, opt)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Step 4: Đơn vị quy đổi & Đóng gói */}
      {currentStepIdx === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>4. Đơn vị & Quy đổi</CardTitle>
            <CardDescription>
              Đơn vị cơ sở dùng để ghi tồn kho. Chỉ thêm đơn vị giao dịch khi thực tế có nhập hoặc xuất theo quy cách khác.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-primary/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Đơn vị cơ sở</p>
              {canConfigureSharedConversions && selectedBaseUnit ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-lg font-semibold">{selectedBaseUnit.name}</span>
                  <span className="text-sm text-muted-foreground">({selectedBaseUnit.symbol})</span>
                  <span className="text-xs text-muted-foreground">— 1 {selectedBaseUnit.name.toLowerCase()} = 1 đơn vị tồn kho</span>
                </div>
              ) : (
                <p className="mt-1 text-sm font-medium text-amber-700">
                  {isMultiSku
                    ? "Các SKU đang dùng đơn vị cơ sở khác nhau. Bảng quy đổi chung chỉ dùng được khi tất cả SKU cùng đơn vị cơ sở."
                    : "Chưa chọn đơn vị cơ sở ở bước SKU & Quy cách."}
                </p>
              )}
            </div>
            {transactionUoms.length === 0 ? (
              <div className="py-8 text-center border rounded-lg border-dashed bg-muted/10 space-y-3">
                <Scale className="size-8 text-muted-foreground/60 mx-auto" />
                <div>
                  <p className="text-sm font-medium">Chưa có đơn vị quy đổi bổ sung</p>
                  <p className="text-xs text-muted-foreground">
                    Không bắt buộc thêm quy đổi. Vật tư có thể nhập, xuất trực tiếp bằng {selectedBaseUnit?.name || "đơn vị cơ sở"}.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addUomRow} disabled={!canConfigureSharedConversions}>
                  <Plus className="size-4 mr-1.5" /> Thêm đơn vị giao dịch
                </Button>
                <p className="text-xs text-muted-foreground">Ví dụ: 1 thùng = 24 cái; 1 bao = 25 kg.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Đơn vị giao dịch bổ sung:</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addUomRow} disabled={!canConfigureSharedConversions}>
                    <Plus className="size-4 mr-1.5" /> Thêm đơn vị
                  </Button>
                </div>

                <div className="space-y-2">
                  {transactionUoms.map((u, idx) => (
                    <div
                      key={u.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg border bg-muted/20"
                    >
                      <Badge variant="secondary" className="shrink-0">
                        #{idx + 1}
                      </Badge>
                      <div className="grid grid-cols-1 sm:grid-cols-[minmax(150px,0.8fr)_minmax(250px,1.4fr)_minmax(220px,1fr)_minmax(180px,0.9fr)] gap-3 flex-1 w-full">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Đơn vị giao dịch</Label>
                          <Select
                          value={u.unitId}
                          onValueChange={(unitId) => {
                            const unit = units.find((candidate) => candidate.id === unitId);
                            setTransactionUoms((prev) =>
                              prev.map((item) =>
                                item.id === u.id
                                  ? {
                                      ...item,
                                      unitId,
                                      code: unit ? transactionUomCode(unit) : "",
                                      displayName: unit?.name || "",
                                    }
                                  : item
                              )
                            );
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn đơn vị" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTransactionUnits(
                              units,
                              effectiveBaseUnitId,
                              transactionUoms.filter((item) => item.id !== u.id).map((item) => item.unitId).filter(Boolean),
                            ).map((unit) => (
                              <SelectItem key={unit.id} value={unit.id}>
                                {unit.name} ({unit.symbol})
                              </SelectItem>
                            ))}
                          </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tên hiển thị</Label>
                          <Input
                          placeholder="VD: Thùng 24 chai"
                          value={u.displayName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTransactionUoms((prev) =>
                              prev.map((item) => (item.id === u.id ? { ...item, displayName: val } : item))
                            );
                          }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">1 {u.displayName || "đơn vị"} bằng</Label>
                          <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min="0.000001"
                            step="any"
                            placeholder="Số lượng"
                            value={u.factorToBase}
                            className="font-bold tabular-nums"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 1;
                              setTransactionUoms((prev) =>
                                prev.map((item) => (item.id === u.id ? { ...item, factorToBase: val } : item))
                              );
                            }}
                          />
                            <span className="text-xs font-semibold shrink-0">
                              {selectedBaseUnit?.name || "ĐVT"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            1 {u.displayName || "đơn vị"} = {u.factorToBase} {selectedBaseUnit?.symbol || "ĐVT"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Mã vạch (không bắt buộc)</Label>
                          <Input
                          placeholder="Quét hoặc nhập mã vạch"
                          value={u.barcode}
                          className="font-mono text-xs"
                          onChange={(e) => {
                            const val = e.target.value;
                            setTransactionUoms((prev) =>
                              prev.map((item) => (item.id === u.id ? { ...item, barcode: val } : item))
                            );
                          }}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive shrink-0 self-end sm:self-center"
                        onClick={() => removeUomRow(u.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5: Rà soát & Kích hoạt */}
      {currentStepIdx === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>5. Rà soát thông tin & Hoàn tất</CardTitle>
            <CardDescription>Kiểm tra lại toàn bộ dữ liệu trước khi kích hoạt vật tư vào danh mục hoạt động.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40 border">
              <div>
                <span className="text-xs text-muted-foreground block">Tên vật tư:</span>
                <span className="text-lg font-bold text-foreground">{name}</span>
                {categoryId && (
                  <Badge variant="outline" className="mt-1">
                    {categories.find((c) => c.id === categoryId)?.name || "Danh mục"}
                  </Badge>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Cấu trúc phân cấp:</span>
                <span className="text-sm font-medium">
                  {isMultiSku
                    ? "Phân cấp " + optionAxes.length + " trục: " + optionAxes.join(" ➔ ")
                    : "1 SKU duy nhất"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Quy cách & SKU ({isMultiSku ? multiSkus.length : 1} SKU):</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="p-2.5 text-left">Quy cách / Tên SKU</th>
                      <th className="p-2.5 text-left">Mã SKU</th>
                      <th className="p-2.5 text-left">ĐVT cơ bản</th>
                      <th className="p-2.5 text-right">Tồn tối thiểu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!isMultiSku ? (
                      <tr>
                        <td className="p-2.5 font-medium">{name} (Mặc định)</td>
                        <td className="p-2.5">
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border border-border/40 font-semibold text-muted-foreground">
                            Hệ thống tự sinh (SKU-xxxx)
                          </span>
                        </td>
                        <td className="p-2.5">{selectedBaseUnit?.name || "—"}</td>
                        <td className="p-2.5 text-right tabular-nums">{minStock}</td>
                      </tr>
                    ) : (
                      multiSkus.map((s) => {
                        const fullLabel = optionAxes.map((a) => s.axisValues[a] || "").filter(Boolean).join(" · ") || "Chưa đặt tên";
                        return (
                          <tr key={s.id}>
                            <td className="p-2.5 font-medium">{fullLabel}</td>
                            <td className="p-2.5">
                              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border border-border/40 font-semibold text-muted-foreground">
                                Hệ thống tự sinh (SKU-xxxx)
                              </span>
                            </td>
                            <td className="p-2.5">{units.find((u) => u.id === s.baseUnitId)?.name || s.baseUnitId || "—"}</td>
                            <td className="p-2.5 text-right tabular-nums">{s.minStock}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {transactionUoms.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Đơn vị quy đổi ({transactionUoms.length} đơn vị):</Label>
                <div className="flex flex-wrap gap-2">
                  {transactionUoms.map((u) => (
                    <Badge key={u.id} variant="secondary" className="p-2 text-xs">
                      1 {u.displayName} = {u.factorToBase} {selectedBaseUnit?.symbol || "ĐVT"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* BOM summary */}
            {!isMultiSku && inventoryPolicy !== "normal" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Wrench className="size-3.5 text-primary" />
                  Bộ lắp ráp — {inventoryPolicy === "virtual_kit" ? "Virtual Kit" : "Stocked Assembly"} ({bomComponents.length} linh kiện):
                </Label>
                {bomComponents.length === 0 ? (
                  <p className="text-xs text-amber-600">⚠️ Chưa khai báo linh kiện BOM</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {bomComponents.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-md border text-xs bg-muted/20">
                        <span className="font-medium">{c.componentLabel}</span>
                        <Badge variant="outline" className="text-xs font-mono">× {c.baseQuantity}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isMultiSku && multiSkus.some((s) => s.inventoryPolicy !== "normal") && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Wrench className="size-3.5 text-primary" />
                  Bộ lắp ráp (BOM) khai báo:
                </Label>
                {multiSkus.filter((s) => s.inventoryPolicy !== "normal").map((s) => {
                  const labelPreview = optionAxes.map((a) => s.axisValues[a] || "").filter(Boolean).join(" · ") || "Quy cách #" + (multiSkus.indexOf(s) + 1);
                  return (
                    <div key={s.id} className="p-2.5 rounded-lg border text-xs space-y-1 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{labelPreview}</span>
                        <Badge variant="secondary" className="text-[10px]">{s.inventoryPolicy === "virtual_kit" ? "Virtual Kit" : "Stocked Assembly"}</Badge>
                        <Badge variant="outline" className="text-[10px]">{s.bomComponents.length} linh kiện</Badge>
                      </div>
                      {s.bomComponents.length === 0 && <p className="text-amber-600">⚠️ Chưa khai báo linh kiện</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStepIdx === 0 || pending}
        >
          <ChevronLeft className="size-4 mr-1.5" /> Quay lại
        </Button>

        <div className="flex items-center gap-2">
          {currentStepIdx < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={pending}>
              Tiếp tục <ChevronRight className="size-4 ml-1.5" />
            </Button>
          ) : (
            <Button onClick={handleActivate} disabled={pending} className="bg-primary text-primary-foreground font-semibold">
              {pending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
              Tạo & Kích hoạt vật tư
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
