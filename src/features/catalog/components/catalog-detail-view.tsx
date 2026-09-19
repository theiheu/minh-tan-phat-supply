"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Boxes,
  History,
  ImageIcon,
  ImagePlus,
  Loader2,
  Package,
  Pencil,
  Plus,
  Save,
  Scale,
  SlidersHorizontal,
  Tag,
  Trash2,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MultiImagePicker } from "@/features/products/components/multi-image-picker";
import { appAssetUrl } from "@/lib/images";
import { formatDate, formatDateTime, formatVnd } from "@/lib/format";
import type { ProductDetailData } from "../data";
import { UnitCombobox } from "./unit-combobox";
import type { CatalogUnit, SkuAttributeValue, TransactionUom } from "../domain/types";
import {
  addSku,
  archiveProduct,
  changeSkuStatus,
  deleteProduct,
  deleteSku,
  deleteTransactionUom,
  saveBomComponents,
  updateProductAxes,
  updateProductMeta,
  updateSku,
  updateSkuImages,
  updateTransactionUom,
  upsertTransactionUom,
} from "../actions";
import type { BomComponentInput } from "../actions";
import { SkuSelector } from "./sku-selector";

const PRESET_GROUPS = [
  { label: "Quy cách đơn giản", axes: ["Quy cách"] },
  { label: "Bạc đạn / Vòng bi", axes: ["Hãng sản xuất", "Mã vòng bi", "Loại nắp"] },
  { label: "Bu lông / Ốc vít", axes: ["Chất liệu", "Đường kính", "Chiều dài"] },
  { label: "Ống nước / Cáp điện", axes: ["Quy cách", "Độ dày"] },
  { label: "Thiết bị điện / Tự động", axes: ["Hãng sản xuất", "Thông số / Công suất"] },
];

export function CatalogDetailView({
  data,
  categories,
  units,
}: {
  data: ProductDetailData;
  categories: { id: string; name: string }[];
  units: CatalogUnit[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Overview Tab Form State
  const [name, setName] = useState(data.product.name);
  const [categoryId, setCategoryId] = useState(data.product.categoryId || "");
  const [description, setDescription] = useState(data.product.description || "");
  const [images, setImages] = useState<string[]>(data.product.images || []);
  const [keywords, setKeywords] = useState((data.product.searchKeywords || []).join(", "));
  const [internalNotes, setInternalNotes] = useState(data.product.internalNotes || "");

  // Collect unique axes from product attribute definitions AND existing SKUs
  const allAxesMap = new Map<string, { id: string; name: string; dataType: string }>();
  for (const ax of data.attributeAxes ?? []) {
    if (ax.id && ax.name) {
      allAxesMap.set(ax.id, { id: ax.id, name: ax.name, dataType: ax.dataType || "text" });
    }
  }
  for (const s of data.skus) {
    for (const a of s.attributes) {
      if (a.attributeDefinitionId && a.attributeName) {
        if (!allAxesMap.has(a.attributeDefinitionId)) {
          allAxesMap.set(a.attributeDefinitionId, {
            id: a.attributeDefinitionId,
            name: a.attributeName,
            dataType: a.dataType || "text",
          });
        }
      }
    }
  }
  const existingAxes = Array.from(allAxesMap.values());
  const [skuAttrInputs, setSkuAttrInputs] = useState<Record<string, string>>({});

  // Manage Axes Modal State
  const [showManageAxes, setShowManageAxes] = useState(false);
  const [manageAxesList, setManageAxesList] = useState<string[]>([]);
  const [customAxisInput, setCustomAxisInput] = useState("");

  // Add SKU Dialog / Form State
  const [showAddSku, setShowAddSku] = useState(false);
  const [newSkuName, setNewSkuName] = useState("");
  const [newSkuUnitId, setNewSkuUnitId] = useState("Cái");
  const [newSkuMinStock, setNewSkuMinStock] = useState(0);
  const [newSkuPrice, setNewSkuPrice] = useState<string>("");
  const [newSkuImages, setNewSkuImages] = useState<string[]>([]);
  const [newSkuInventoryPolicy, setNewSkuInventoryPolicy] = useState<"normal" | "virtual_kit" | "stocked_assembly">("normal");

  // Sku Images Modal State
  const [editingSkuForImages, setEditingSkuForImages] = useState<ProductDetailData["skus"][0] | null>(null);
  const [skuImages, setSkuImages] = useState<string[]>([]);

  // Full Edit SKU Modal State
  const [editingSku, setEditingSku] = useState<ProductDetailData["skus"][0] | null>(null);
  const [editSkuUnitId, setEditSkuUnitId] = useState("");
  const [editSkuMinStock, setEditSkuMinStock] = useState(0);
  const [editSkuPrice, setEditSkuPrice] = useState<string>("");
  const [editSkuImages, setEditSkuImages] = useState<string[]>([]);
  const [editSkuAttrInputs, setEditSkuAttrInputs] = useState<Record<string, string>>({});
  const [editSkuSpecName, setEditSkuSpecName] = useState("");
  const [editSkuInventoryPolicy, setEditSkuInventoryPolicy] = useState<"normal" | "virtual_kit" | "stocked_assembly">("normal");

  // Add UOM Dialog / Form State
  const [showAddUom, setShowAddUom] = useState(false);
  const [targetSkuId, setTargetSkuId] = useState(data.skus[0]?.id || "");
  const [newUomDisplayName, setNewUomDisplayName] = useState("");
  const [newUomFactor, setNewUomFactor] = useState(10);
  const [newUomBarcode, setNewUomBarcode] = useState("");

  // Edit UOM Modal State
  const [editingUom, setEditingUom] = useState<TransactionUom | null>(null);
  const [editUomDisplayName, setEditUomDisplayName] = useState("");
  const [editUomFactor, setEditUomFactor] = useState(1);
  const [editUomBarcode, setEditUomBarcode] = useState("");

  // BOM editing state — dùng cho tab Cấu tạo BOM (edit BOM components của SKU có sẵn)
  const assemblySkus = data.skus.filter((s) => s.inventoryPolicy === "virtual_kit" || s.inventoryPolicy === "stocked_assembly");
  const [bomEditSkuId, setBomEditSkuId] = useState<string>(assemblySkus[0]?.id ?? data.skus[0]?.id ?? "");
  const [bomEditing, setBomEditing] = useState(false);
  const [bomEditPolicy, setBomEditPolicy] = useState<"virtual_kit" | "stocked_assembly">("virtual_kit");
  const [bomEditComponents, setBomEditComponents] = useState<
    Array<{
      id: string;
      componentSkuId: string;
      componentLabel: string;
      componentSkuCode: string;
      baseQuantity: number;
    }>
  >([]);

  function startBomEdit(skuId: string) {
    const sku = data.skus.find((s) => s.id === skuId);
    const currentPolicy = (sku?.inventoryPolicy === "virtual_kit" || sku?.inventoryPolicy === "stocked_assembly")
      ? (sku.inventoryPolicy as "virtual_kit" | "stocked_assembly")
      : "virtual_kit";
    setBomEditPolicy(currentPolicy);
    setBomEditSkuId(skuId);
    const skuBomItems = data.bomItems.filter((b) => b.parentSkuId === skuId);
    setBomEditComponents(
      skuBomItems.map((b, i) => ({
        id: "existing-" + i,
        componentSkuId: b.componentSkuId,
        componentLabel: b.componentName,
        componentSkuCode: b.componentSkuCode,
        baseQuantity: b.quantity,
      }))
    );
    setBomEditing(true);
  }

  function handleSaveBom() {
    if (bomEditComponents.length === 0) {
      toast.error("Bộ lắp ráp phải có ít nhất 1 linh kiện");
      return;
    }
    startTransition(async () => {
      try {
        const comps: BomComponentInput[] = bomEditComponents.map((c) => ({
          componentSkuId: c.componentSkuId,
          baseQuantity: c.baseQuantity,
        }));
        await saveBomComponents(bomEditSkuId, comps, bomEditPolicy);
        toast.success("Đã lưu danh sách linh kiện BOM thành công!");
        setBomEditing(false);
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lưu BOM thất bại");
      }
    });
  }

  // Save Overview Metadata
  function handleSaveOverview() {
    startTransition(async () => {
      try {
        const searchKeywords = keywords
          .split(",")
          .map((k: string) => k.trim())
          .filter(Boolean);

        await updateProductMeta(data.product.id, {
          name: name.trim(),
          categoryId: categoryId || undefined,
          description: description.trim() || undefined,
          images,
          searchKeywords,
          internalNotes: internalNotes.trim() || undefined,
        });
        toast.success("Đã lưu thông tin vật tư thành công!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
      }
    });
  }

  // Delete Product
  function handleDeleteProduct() {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa vật tư "${data.product.name}"? Vật tư sẽ bị xóa khỏi danh mục.`
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteProduct(data.product.id);
        toast.success(`Đã xóa vật tư "${data.product.name}" thành công!`);
        router.push("/admin/products");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa vật tư thất bại");
      }
    });
  }

  // Archive Product
  function handleArchive() {
    if (!confirm("Bạn có chắc chắn muốn lưu trữ vật tư này?")) return;
    startTransition(async () => {
      try {
        await archiveProduct(data.product.id);
        toast.success("Đã lưu trữ vật tư.");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      }
    });
  }

  // Manage Axes Handlers
  function handleOpenManageAxes() {
    const currentNames = existingAxes.map((a) => a.name);
    setManageAxesList(currentNames.length > 0 ? currentNames : ["Quy cách"]);
    setCustomAxisInput("");
    setShowManageAxes(true);
  }

  function handleAddAxisName(axisName: string) {
    const clean = axisName.trim();
    if (!clean) return;
    if (manageAxesList.includes(clean)) {
      toast.error("Nhóm quy cách này đã có trong danh sách");
      return;
    }
    if (manageAxesList.length >= 5) {
      toast.error("Tối đa 5 nhóm quy cách cho một vật tư");
      return;
    }
    setManageAxesList((prev) => [...prev, clean]);
    setCustomAxisInput("");
  }

  function handleRemoveAxisName(idx: number) {
    setManageAxesList((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSaveAxes() {
    if (manageAxesList.length === 0) {
      toast.error("Vui lòng giữ ít nhất 1 nhóm quy cách hoặc hủy bỏ");
      return;
    }
    startTransition(async () => {
      try {
        await updateProductAxes({
          productId: data.product.id,
          axes: manageAxesList,
        });
        toast.success("Đã cập nhật nhóm quy cách thành công!");
        setShowManageAxes(false);
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật nhóm quy cách thất bại");
      }
    });
  }

  // Toggle SKU Status
  function handleToggleSkuStatus(skuId: string, currentStatus: string) {
    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    startTransition(async () => {
      try {
        await changeSkuStatus({
          skuId,
          status: nextStatus as "active" | "inactive",
          reason: "Thay đổi qua bảng điều khiển quản trị",
        });
        toast.success("Đã " + (nextStatus === "active" ? "kích hoạt" : "tạm ngừng") + " SKU");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Đổi trạng thái thất bại");
      }
    });
  }

  // Open SKU Images Modal
  function handleOpenSkuImagesModal(sku: ProductDetailData["skus"][0]) {
    setEditingSkuForImages(sku);
    setSkuImages(sku.images || []);
  }

  // Save SKU Images
  function handleSaveSkuImages() {
    if (!editingSkuForImages) return;
    startTransition(async () => {
      try {
        await updateSkuImages({ skuId: editingSkuForImages.id, images: skuImages });
        toast.success("Đã cập nhật hình ảnh cho SKU " + editingSkuForImages.skuCode);
        setEditingSkuForImages(null);
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật ảnh thất bại");
      }
    });
  }

  // Open Full Edit SKU Modal
  function handleOpenEditSku(sku: ProductDetailData["skus"][0]) {
    setEditingSku(sku);
    const skuUnit = units.find((u) => u.id === sku.baseUnitId);
    setEditSkuUnitId(skuUnit?.name || sku.baseUnitName || sku.baseUnitSymbol || sku.baseUnitId || "Cái");
    setEditSkuMinStock(sku.minStock);
    setEditSkuPrice(sku.price != null ? String(sku.price) : "");
    setEditSkuImages(sku.images || []);
    const policy = sku.inventoryPolicy as "normal" | "virtual_kit" | "stocked_assembly";
    setEditSkuInventoryPolicy(["normal", "virtual_kit", "stocked_assembly"].includes(policy) ? policy : "normal");

    const attrMap: Record<string, string> = {};
    for (const a of sku.attributes) {
      if (a.attributeDefinitionId) {
        attrMap[a.attributeDefinitionId] =
          a.textValue ?? (a.numericValue != null ? String(a.numericValue) : a.legacyTextValue ?? "");
      }
    }
    setEditSkuAttrInputs(attrMap);

    const firstVal = sku.attributes[0]?.textValue ?? sku.attributes[0]?.legacyTextValue ?? "";
    setEditSkuSpecName(firstVal);
  }

  // Save Full Edit SKU
  function handleSaveEditSku() {
    if (!editingSku) return;
    if (!editSkuUnitId) {
      toast.error("Vui lòng chọn đơn vị tính cơ bản");
      return;
    }

    let attrValues: Array<{
      attributeDefinitionId?: string;
      attributeName?: string;
      textValue: string;
    }> = [];

    if (existingAxes.length > 0) {
      attrValues = existingAxes.map((axis) => ({
        attributeDefinitionId: axis.id,
        attributeName: axis.name,
        textValue: (editSkuAttrInputs[axis.id] || "").trim(),
      }));
    } else {
      attrValues = editSkuSpecName.trim()
        ? [{ attributeName: "Quy cách", textValue: editSkuSpecName.trim() }]
        : [];
    }

    startTransition(async () => {
      try {
        await updateSku({
          skuId: editingSku.id,
          skuCode: editingSku.skuCode || undefined,
          baseUnitId: editSkuUnitId,
          minStock: editSkuMinStock,
          price: editSkuPrice ? parseFloat(editSkuPrice) : null,
          trackingPolicy: (editingSku.trackingPolicy as "none" | "lot" | "lot_expiry" | "serial") || "none",
          inventoryPolicy: editSkuInventoryPolicy,
          allowFraction: editingSku.allowFraction,
          images: editSkuImages,
          attributeValues: attrValues as SkuAttributeValue[],
        });
        toast.success("Đã cập nhật thông tin SKU thành công!");
        setEditingSku(null);
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật SKU thất bại");
      }
    });
  }

  // Delete SKU
  function handleDeleteSku(sku: ProductDetailData["skus"][0]) {
    if (
      !confirm(
        'Bạn có chắc chắn muốn xóa SKU "' +
          sku.skuCode +
          '"? Thao tác chỉ thành công khi SKU chưa phát sinh giao dịch hoặc tồn kho.'
      )
    )
      return;

    startTransition(async () => {
      try {
        await deleteSku(sku.id);
        toast.success("Đã xóa SKU thành công!");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa SKU thất bại");
      }
    });
  }

  // Submit Add SKU
  function handleAddSkuSubmit() {
    if (!newSkuUnitId) {
      toast.error("Vui lòng chọn đơn vị tính");
      return;
    }

    let attrValues: Array<{
      attributeDefinitionId?: string;
      attributeName?: string;
      textValue: string;
    }> = [];

    if (existingAxes.length > 0) {
      attrValues = existingAxes
        .filter((axis) => skuAttrInputs[axis.id]?.trim())
        .map((axis) => ({
          attributeDefinitionId: axis.id,
          attributeName: axis.name,
          textValue: skuAttrInputs[axis.id].trim(),
        }));

      if (attrValues.length === 0 && newSkuName.trim()) {
        attrValues = [{
          attributeName: "Quy cách",
          textValue: newSkuName.trim(),
        }];
      }
    } else {
      if (newSkuName.trim()) {
        attrValues = [{
          attributeName: "Quy cách",
          textValue: newSkuName.trim(),
        }];
      }
    }

    startTransition(async () => {
      try {
        await addSku({
          productId: data.product.id,
          skuCode: undefined,
          baseUnitId: newSkuUnitId,
          minStock: newSkuMinStock,
          price: newSkuPrice ? parseFloat(newSkuPrice) : null,
          trackingPolicy: "none",
          inventoryPolicy: newSkuInventoryPolicy,
          allowFraction: false,
          images: newSkuImages,
          attributeValues: attrValues as SkuAttributeValue[],
        });
        toast.success("Đã thêm SKU mới thành công!");
        setShowAddSku(false);
        setNewSkuName("");
        setSkuAttrInputs({});
        setNewSkuImages([]);
        setNewSkuPrice("");
        setNewSkuInventoryPolicy("normal");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thêm SKU thất bại");
      }
    });
  }

  // Submit Add UOM
  function handleAddUomSubmit() {
    if (!newUomDisplayName.trim() || newUomFactor <= 0) {
      toast.error("Vui lòng nhập tên đơn vị và hệ số quy đổi hợp lệ (> 0)");
      return;
    }
    startTransition(async () => {
      try {
        const sku = data.skus.find((s) => s.id === targetSkuId) || data.skus[0];
        await upsertTransactionUom({
          skuId: sku.id,
          unitId: sku.baseUnitId,
          code: newUomDisplayName.trim().toUpperCase(),
          displayName: newUomDisplayName.trim(),
          factorToBase: newUomFactor,
          allowReceipt: true,
          allowIssue: true,
          allowFraction: false,
          barcode: newUomBarcode.trim() || undefined,
        });
        toast.success("Đã thêm đơn vị quy đổi!");
        setShowAddUom(false);
        setNewUomDisplayName("");
        setNewUomBarcode("");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thêm đơn vị thất bại");
      }
    });
  }

  // Open Edit UOM
  function handleOpenEditUom(uom: TransactionUom) {
    setEditingUom(uom);
    setEditUomDisplayName(uom.displayName);
    setEditUomFactor(uom.factorToBase);
    setEditUomBarcode(uom.barcode || "");
  }

  // Save Edit UOM
  function handleSaveEditUom() {
    if (!editingUom) return;
    if (!editUomDisplayName.trim() || editUomFactor <= 0) {
      toast.error("Vui lòng nhập tên đơn vị và hệ số quy đổi hợp lệ (> 0)");
      return;
    }

    startTransition(async () => {
      try {
        await updateTransactionUom({
          uomId: editingUom.id,
          displayName: editUomDisplayName.trim(),
          factorToBase: editUomFactor,
          barcode: editUomBarcode.trim() || undefined,
        });
        toast.success("Đã cập nhật đơn vị quy đổi thành công!");
        setEditingUom(null);
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật đơn vị thất bại");
      }
    });
  }

  // Delete UOM
  function handleDeleteUom(uom: TransactionUom) {
    if (!confirm('Bạn có chắc chắn muốn xóa đơn vị quy đổi "' + uom.displayName + '"?')) return;

    startTransition(async () => {
      try {
        await deleteTransactionUom(uom.id);
        toast.success("Đã xóa đơn vị quy đổi!");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa đơn vị thất bại");
      }
    });
  }

  const totalAvailableStock = data.skus.reduce((sum: number, s) => sum + s.stockAvailable, 0);

  return (
    <div className="space-y-6">
      {/* Header Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-3">
          <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={data.product.catalogStatus === "active" ? "default" : "secondary"}>
                  {data.product.catalogStatus === "active" ? "Đang kinh doanh" : "Lưu trữ"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Tạo ngày {formatDate(data.product.createdAt)} · Cập nhật {formatDate(data.product.updatedAt)}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight">{data.product.name}</h2>
              {data.product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 max-w-2xl">
                  {data.product.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground hover:text-amber-600"
                onClick={handleArchive}
                disabled={pending}
              >
                {data.product.catalogStatus === "active" ? "Lưu trữ" : "Khôi phục"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:border-destructive"
                onClick={handleDeleteProduct}
                disabled={pending}
              >
                <Trash2 className="size-4 mr-1.5" />
                Xóa vật tư
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stat Card */}
        <Card className="flex flex-col justify-center">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
              <Warehouse className="size-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Tổng tồn khả dụng</p>
              <h3 className="text-2xl font-bold tabular-nums">
                {totalAvailableStock}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {data.skus[0]?.baseUnitSymbol}
                </span>
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs View */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/60 p-1 flex-wrap h-auto">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <Package className="size-4" /> Tổng quan
          </TabsTrigger>
          <TabsTrigger value="skus" className="gap-1.5 text-xs sm:text-sm">
            <Boxes className="size-4" /> Danh sách SKU ({data.skus.length})
          </TabsTrigger>
          <TabsTrigger value="uoms" className="gap-1.5 text-xs sm:text-sm">
            <Scale className="size-4" /> Đơn vị & Quy đổi
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-1.5 text-xs sm:text-sm">
            <Warehouse className="size-4" /> Tồn kho theo vị trí
          </TabsTrigger>
          {(data.bomItems.length > 0 || assemblySkus.length > 0) && (
            <TabsTrigger value="bom" className="gap-1.5 text-xs sm:text-sm">
              <Wrench className="size-4" /> Cấu tạo BOM ({assemblySkus.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="logs" className="gap-1.5 text-xs sm:text-sm">
            <History className="size-4" /> Nhật ký thay đổi
          </TabsTrigger>
        </TabsList>

        {/* 1. Tab Tổng quan */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin chung</CardTitle>
              <CardDescription>Cập nhật tên gọi, danh mục, từ khóa và hình ảnh hiển thị của vật tư.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Tên vật tư</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-category">Danh mục phân loại</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger id="edit-category">
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
                  <Label htmlFor="edit-keywords">Từ khóa tìm kiếm</Label>
                  <Input
                    id="edit-keywords"
                    placeholder="VD: bạc đạn, vòng bi, skf..."
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Mô tả / Thông số kỹ thuật</Label>
                <Textarea
                  id="edit-desc"
                  rows={3}
                  placeholder="Thông số kỹ thuật, hướng dẫn bảo quản..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-notes">Ghi chú nội bộ</Label>
                <Textarea
                  id="edit-notes"
                  rows={2}
                  placeholder="Ghi chú dành riêng cho nội bộ quản lý..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Hình ảnh nhận diện</Label>
                <MultiImagePicker
                  images={images}
                  onChange={setImages}
                  disabled={pending}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveOverview} disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                  Lưu thay đổi
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Tab Danh sách SKU */}
        <TabsContent value="skus">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span>Quy cách & Mã SKU</span>
                  <Badge variant="outline" className="font-normal text-xs">
                    {data.skus.length} SKU
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  Chỉnh sửa, khai báo quy cách, đơn vị tính cơ bản và tồn tối thiểu từng SKU.
                </CardDescription>
                {existingAxes.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-medium">Nhóm quy cách:</span>
                    {existingAxes.map((a) => (
                      <Badge key={a.id} variant="secondary" className="text-xs">
                        <Tag className="size-3 mr-1 text-primary" /> {a.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={handleOpenManageAxes}>
                  <SlidersHorizontal className="size-4 mr-1.5" /> Nhóm quy cách ({existingAxes.length})
                </Button>
                <Button size="sm" onClick={() => setShowAddSku(!showAddSku)}>
                  <Plus className="size-4 mr-1.5" /> Thêm SKU mới
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Form thêm SKU mới */}
              {showAddSku && (
                <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Thêm quy cách / SKU mới:</h4>
                    <Button variant="ghost" size="xs" onClick={handleOpenManageAxes} className="text-xs text-primary">
                      <SlidersHorizontal className="size-3 mr-1" /> Cấu hình nhóm quy cách
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {existingAxes.length > 0 ? (
                      existingAxes.map((axis) => (
                        <div key={axis.id} className="space-y-1">
                          <Label>{axis.name}</Label>
                          <Input
                            placeholder={"Nhập " + axis.name.toLowerCase() + "..."}
                            value={skuAttrInputs[axis.id] || ""}
                            onChange={(e) =>
                              setSkuAttrInputs((prev) => ({ ...prev, [axis.id]: e.target.value }))
                            }
                          />
                        </div>
                      ))
                    ) : (
                      <div className="space-y-1">
                        <Label>Tên quy cách</Label>
                        <Input
                          placeholder="VD: Size L, 50W, Phi 21..."
                          value={newSkuName}
                          onChange={(e) => setNewSkuName(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Đơn vị tính cơ bản</Label>
                      <UnitCombobox
                        value={newSkuUnitId}
                        onChange={setNewSkuUnitId}
                        units={units}
                        placeholder="Chọn hoặc nhập ĐVT (VD: Cái, Hộp, Bộ...)"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Tồn tối thiểu</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newSkuMinStock}
                        onChange={(e) => setNewSkuMinStock(parseInt(e.target.value, 10) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Đơn giá tham chiếu (VNĐ)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Đơn giá..."
                        value={newSkuPrice}
                        onChange={(e) => setNewSkuPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Loại vật tư / Tồn kho</Label>
                      <Select
                        value={newSkuInventoryPolicy}
                        onValueChange={(v: "normal" | "virtual_kit" | "stocked_assembly") => setNewSkuInventoryPolicy(v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Thông thường</SelectItem>
                          <SelectItem value="virtual_kit">Bộ ảo — tính tồn theo linh kiện</SelectItem>
                          <SelectItem value="stocked_assembly">Bộ lắp ráp — tồn kho riêng</SelectItem>
                        </SelectContent>
                      </Select>
                      {newSkuInventoryPolicy !== "normal" && (
                        <p className="text-xs text-amber-600 mt-1">⚙️ Sau khi thêm SKU, vào tab &quot;Cấu tạo BOM&quot; để khai báo linh kiện.</p>
                      )}
                    </div>
                  </div>

                  {/* Hình ảnh riêng cho SKU mới */}
                  <div className="space-y-1.5 pt-2 border-t">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <ImagePlus className="size-3.5 text-primary" />
                      Hình ảnh riêng cho SKU mới ({newSkuImages.length} ảnh):
                    </Label>
                    <MultiImagePicker
                      images={newSkuImages}
                      onChange={setNewSkuImages}
                      disabled={pending}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddSku(false)}>
                      Hủy
                    </Button>
                    <Button size="sm" onClick={handleAddSkuSubmit} disabled={pending}>
                      Lưu SKU
                    </Button>
                  </div>
                </div>
              )}

              {/* Bảng danh sách SKU */}
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14 text-center">Ảnh</TableHead>
                      <TableHead>Mã SKU</TableHead>
                      <TableHead>Quy cách / Thuộc tính</TableHead>
                      <TableHead>ĐVT cơ bản</TableHead>
                      <TableHead className="text-right">Tồn thực tế</TableHead>
                      <TableHead className="text-right">Khả dụng</TableHead>
                      <TableHead className="text-right">Tồn tối thiểu</TableHead>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.skus.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-center py-2">
                          {s.images && s.images.length > 0 ? (
                            <div
                              className="relative size-10 rounded border border-border/60 overflow-hidden mx-auto bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                              onClick={() => handleOpenSkuImagesModal(s)}
                              title="Bấm để xem & sửa ảnh SKU này"
                            >
                              <Image
                                src={appAssetUrl(s.images[0]) || s.images[0]}
                                alt={s.skuCode}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                              {s.images.length > 1 && (
                                <span className="absolute bottom-0 right-0 bg-black/75 text-white text-[9px] px-1 rounded-tl font-bold leading-tight">
                                  {s.images.length}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              className="size-8 border-dashed text-muted-foreground hover:text-primary hover:border-primary mx-auto"
                              onClick={() => handleOpenSkuImagesModal(s)}
                              title="Thêm ảnh cho SKU này"
                            >
                              <ImagePlus className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold bg-muted px-2 py-0.5 rounded border border-border/50 text-foreground inline-block">
                            {s.skuCode}
                          </span>
                        </TableCell>
                        <TableCell>
                          {s.attributes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.attributes.map((a: SkuAttributeValue, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs font-normal">
                                  <span className="text-muted-foreground mr-1">{a.attributeName}:</span>
                                  <span className="font-semibold text-foreground">{a.textValue || a.numericValue || a.legacyTextValue}</span>
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            data.skus.length === 1 ? (
                              <span className="text-muted-foreground text-xs italic">Mặc định (1 quy cách)</span>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50/60 text-xs">
                                Chưa đặt quy cách
                              </Badge>
                            )
                          )}
                        </TableCell>
                        <TableCell>{s.baseUnitName || s.baseUnitSymbol || "—"}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{s.stockOnHand}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums text-foreground">{s.stockAvailable}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{s.minStock}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {s.price != null ? formatVnd(s.price) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.skuStatus === "active" ? "default" : "secondary"}>
                            {s.skuStatus === "active" ? "Hoạt động" : "Tạm ngừng"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Nút sửa SKU đầy đủ */}
                            <Button
                              variant="outline"
                              size="icon-xs"
                              className="size-7 text-muted-foreground hover:text-primary hover:border-primary"
                              onClick={() => handleOpenEditSku(s)}
                              title="Chỉnh sửa thông tin SKU"
                            >
                              <Pencil className="size-3.5" />
                            </Button>

                            {/* Nút sửa ảnh SKU */}
                            <Button
                              variant="outline"
                              size="icon-xs"
                              className="size-7 text-muted-foreground hover:text-primary"
                              onClick={() => handleOpenSkuImagesModal(s)}
                              title="Quản lý ảnh cho SKU"
                            >
                              <ImageIcon className="size-3.5" />
                            </Button>

                            {/* Nút đổi trạng thái active/inactive */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2"
                              onClick={() => handleToggleSkuStatus(s.id, s.skuStatus)}
                              disabled={pending}
                            >
                              {s.skuStatus === "active" ? "Tắt" : "Bật"}
                            </Button>

                            {/* Nút xóa SKU an toàn */}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteSku(s)}
                              disabled={pending}
                              title="Xóa SKU (khi chưa phát sinh giao dịch)"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Tab Đơn vị & Quy đổi */}
        <TabsContent value="uoms">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Đơn vị tính & Hệ số đóng gói</CardTitle>
                <CardDescription>Cấu hình các đơn vị đóng gói giao dịch nhập/xuất kho (Thùng, Hộp, Bao, Can...).</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowAddUom(!showAddUom)}>
                <Plus className="size-4 mr-1.5" /> Thêm đơn vị quy đổi
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddUom && (
                <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                  <h4 className="font-semibold text-sm">Thêm đơn vị đóng gói:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label>Áp dụng cho SKU</Label>
                      <Select value={targetSkuId} onValueChange={setTargetSkuId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {data.skus.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.skuCode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Tên đơn vị</Label>
                      <Input
                        placeholder="VD: Thùng 24 lon"
                        value={newUomDisplayName}
                        onChange={(e) => setNewUomDisplayName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Hệ số quy đổi (= ĐVT chuẩn)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={newUomFactor}
                        onChange={(e) => setNewUomFactor(parseFloat(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Mã vạch riêng (tùy chọn)</Label>
                      <Input
                        placeholder="Mã vạch"
                        value={newUomBarcode}
                        onChange={(e) => setNewUomBarcode(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddUom(false)}>
                      Hủy
                    </Button>
                    <Button size="sm" onClick={handleAddUomSubmit} disabled={pending}>
                      Lưu đơn vị
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {data.skus.map((s) => (
                  <div key={s.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">
                        SKU: <span className="font-mono">{s.skuCode}</span> — {s.baseUnitName || s.baseUnitSymbol || "ĐVT"}
                      </div>
                      <Badge variant="outline">ĐVT chuẩn: {s.baseUnitName || s.baseUnitSymbol}</Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                      {s.transactionUoms.map((u: TransactionUom) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2.5 rounded-md border bg-muted/20 text-xs gap-2"
                        >
                          <div className="space-y-0.5">
                            <span className="font-medium block">{u.displayName}</span>
                            {u.barcode && (
                              <span className="text-muted-foreground font-mono text-[11px] block">
                                📟 {u.barcode}
                              </span>
                            )}
                            <Badge variant="secondary" className="font-bold text-[11px] mt-0.5">
                              = {u.factorToBase} {s.baseUnitName || s.baseUnitSymbol}
                            </Badge>
                          </div>
                          {!u.isBase && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="size-6 text-muted-foreground hover:text-primary"
                                onClick={() => handleOpenEditUom(u)}
                                title="Sửa đơn vị quy đổi"
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="size-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteUom(u)}
                                title="Xóa đơn vị quy đổi"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Tab Tồn kho theo vị trí */}
        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>Phân bổ tồn kho theo vị trí</CardTitle>
              <CardDescription>Số lượng tồn kho thực tế và số lượng đã được giữ chỗ theo từng kho.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.stockByLocation.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                  Hiện chưa có số dư tồn kho tại bất kỳ vị trí nào.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vị trí kho</TableHead>
                        <TableHead>Mã SKU</TableHead>
                        <TableHead className="text-right">Tồn thực tế</TableHead>
                        <TableHead className="text-right">Đã giữ chỗ</TableHead>
                        <TableHead className="text-right">Tồn khả dụng</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.stockByLocation.map((loc, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{loc.locationName} ({loc.locationCode})</TableCell>
                          <TableCell className="font-mono text-xs">{loc.skuCode}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {loc.quantity} {loc.unitSymbol}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {loc.reservedQuantity} {loc.unitSymbol}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-foreground">
                            {loc.availableQuantity} {loc.unitSymbol}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Tab Cấu tạo BOM */}
        {(data.bomItems.length > 0 || assemblySkus.length > 0) && (
          <TabsContent value="bom">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Cấu tạo linh kiện (BOM)</CardTitle>
                  <CardDescription>
                    Khai báo linh kiện định mức cho SKU bộ lắp ráp. Tồn Virtual Kit tự tính từ linh kiện; Stocked Assembly có tồn kho riêng.
                  </CardDescription>
                </div>
                {!bomEditing && (
                  <Button size="sm" variant="outline" onClick={() => startBomEdit(bomEditSkuId || data.skus[0]?.id || "")}>
                    <Pencil className="size-3.5 mr-1.5" /> Chỉnh sửa BOM
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* SKU selector khi có nhiều SKU assembly */}
                {assemblySkus.length > 1 && (
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground whitespace-nowrap">SKU bộ:</Label>
                    <Select value={bomEditSkuId} onValueChange={setBomEditSkuId}>
                      <SelectTrigger className="w-auto min-w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assemblySkus.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.skuCode} — {s.inventoryPolicy === "virtual_kit" ? "Virtual Kit" : "Stocked Assembly"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Read-only view */}
                {!bomEditing && (() => {
                  const currentBomItems = data.bomItems.filter((b) => b.parentSkuId === bomEditSkuId);
                  return (
                    <>
                      {currentBomItems.length === 0 ? (
                        <div className="py-8 text-center border rounded-lg border-dashed bg-muted/10 space-y-2">
                          <Wrench className="size-8 text-muted-foreground/50 mx-auto" />
                          <p className="text-sm font-medium text-muted-foreground">Chưa có linh kiện BOM nào</p>
                          <p className="text-xs text-muted-foreground">Bấm &quot;Chỉnh sửa BOM&quot; để khai báo linh kiện.</p>
                        </div>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tên linh kiện</TableHead>
                                <TableHead>Mã SKU</TableHead>
                                <TableHead className="text-right">Định mức / bộ</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {currentBomItems.map((b, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{b.componentName}</TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">{b.componentSkuCode}</TableCell>
                                  <TableCell className="text-right font-bold tabular-nums">
                                    {b.quantity} {b.unitSymbol}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Edit BOM form */}
                {bomEditing && (
                  <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">Chỉnh sửa định mức linh kiện</h4>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Chính sách tồn:</Label>
                        <Select
                          value={bomEditPolicy}
                          onValueChange={(v: "virtual_kit" | "stocked_assembly") => setBomEditPolicy(v)}
                        >
                          <SelectTrigger className="h-8 text-xs w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="virtual_kit">Virtual Kit (Bộ ảo)</SelectItem>
                            <SelectItem value="stocked_assembly">Stocked Assembly (Lắp ráp)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Thêm linh kiện:</Label>
                      <SkuSelector
                        onSelect={(opt) => {
                          if (bomEditComponents.some((c) => c.componentSkuId === opt.skuId)) {
                            toast.error("Linh kiện này đã có trong danh sách");
                            return;
                          }
                          setBomEditComponents((prev) => [
                            ...prev,
                            {
                              id: "new-" + Date.now(),
                              componentSkuId: opt.skuId,
                              componentLabel: opt.productName + (opt.summary && opt.summary !== "SKU" ? " — " + opt.summary : ""),
                              componentSkuCode: opt.skuCode,
                              baseQuantity: 1,
                            },
                          ]);
                        }}
                        placeholder="Tìm kiếm vật tư linh kiện để thêm vào bộ..."
                      />
                    </div>

                    <div className="space-y-2">
                      {bomEditComponents.map((comp, i) => (
                        <div key={comp.id} className="flex items-center justify-between p-2.5 rounded-md border bg-background text-sm gap-3">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium block truncate">{comp.componentLabel}</span>
                            <span className="font-mono text-xs text-muted-foreground">{comp.componentSkuCode}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Định mức:</Label>
                            <Input
                              type="number"
                              min="0.001"
                              step="any"
                              value={comp.baseQuantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setBomEditComponents((prev) =>
                                  prev.map((c, idx) => (idx === i ? { ...c, baseQuantity: val } : c))
                                );
                              }}
                              className="w-24 h-8 text-right"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setBomEditComponents((prev) => prev.filter((_, idx) => idx !== i))}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" onClick={() => setBomEditing(false)} disabled={pending}>
                        Hủy
                      </Button>
                      <Button size="sm" onClick={handleSaveBom} disabled={pending}>
                        {pending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                        Lưu BOM
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 6. Tab Nhật ký thay đổi (Audit logs) */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Nhật ký hoạt động</CardTitle>
              <CardDescription>Lịch sử thay đổi thông tin, SKU, đơn vị quy đổi và BOM của vật tư.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.auditLogs.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                  Chưa có nhật ký hoạt động nào được ghi nhận.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.auditLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg border bg-muted/20 space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary">{log.action}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Thực hiện bởi: <span className="font-medium text-foreground">{log.actorName}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Chỉnh sửa thông tin chi tiết SKU */}
      <Dialog open={Boolean(editingSku)} onOpenChange={(open) => !open && setEditingSku(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Pencil className="size-4 text-primary" />
              Chỉnh sửa SKU: <span className="font-mono text-primary font-bold">{editingSku?.skuCode}</span>
            </DialogTitle>
            <DialogDescription>
              Cập nhật đơn vị tính cơ bản, tồn tối thiểu, đơn giá và các thuộc tính quy cách.
            </DialogDescription>
          </DialogHeader>

          {editingSku && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Đơn vị tính cơ bản</Label>
                  <UnitCombobox
                    value={editSkuUnitId}
                    onChange={setEditSkuUnitId}
                    units={units}
                    placeholder="Chọn hoặc nhập ĐVT (VD: Cái, Hộp, Bộ...)"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Tồn tối thiểu (Cảnh báo hết hàng)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editSkuMinStock}
                    onChange={(e) => setEditSkuMinStock(parseInt(e.target.value, 10) || 0)}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Đơn giá tham chiếu (VNĐ)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="VD: 50000"
                    value={editSkuPrice}
                    onChange={(e) => setEditSkuPrice(e.target.value)}
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label>Loại vật tư / Chính sách tồn kho</Label>
                  <Select
                    value={editSkuInventoryPolicy}
                    onValueChange={(v: "normal" | "virtual_kit" | "stocked_assembly") => setEditSkuInventoryPolicy(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Vật tư thông thường (tồn kho riêng)</SelectItem>
                      <SelectItem value="virtual_kit">Bộ ảo — tồn tính từ linh kiện (Virtual Kit)</SelectItem>
                      <SelectItem value="stocked_assembly">Bộ lắp ráp — tồn kho riêng (Stocked Assembly)</SelectItem>
                    </SelectContent>
                  </Select>
                  {editSkuInventoryPolicy !== "normal" && (
                    <p className="text-xs text-amber-600 mt-1">⚙️ Sau khi lưu, vào tab &quot;Cấu tạo BOM&quot; để khai báo linh kiện.</p>
                  )}
                </div>
              </div>

              {/* Các trục thuộc tính của SKU */}
              {existingAxes.length > 0 ? (
                <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">
                      Thuộc tính quy cách ({existingAxes.length} nhóm):
                    </Label>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setEditingSku(null);
                        handleOpenManageAxes();
                      }}
                      className="text-xs text-primary"
                    >
                      <SlidersHorizontal className="size-3 mr-1" /> Thêm/bớt nhóm quy cách
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {existingAxes.map((axis) => (
                      <div key={axis.id} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{axis.name}</Label>
                        <Input
                          placeholder={"Nhập " + axis.name.toLowerCase() + "..."}
                          value={editSkuAttrInputs[axis.id] || ""}
                          onChange={(e) =>
                            setEditSkuAttrInputs((prev) => ({ ...prev, [axis.id]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Quy cách / Phân loại</Label>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setEditingSku(null);
                        handleOpenManageAxes();
                      }}
                      className="text-xs text-primary"
                    >
                      <SlidersHorizontal className="size-3 mr-1" /> Thiết lập nhiều nhóm quy cách
                    </Button>
                  </div>
                  <Input
                    placeholder="VD: Size L, Phi 21, 50W..."
                    value={editSkuSpecName}
                    onChange={(e) => setEditSkuSpecName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nhập tên quy cách cụ thể cho SKU này nếu vật tư có nhiều thông số khác nhau.
                  </p>
                </div>
              )}

              {/* Ảnh riêng cho SKU */}
              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <ImagePlus className="size-3.5 text-primary" />
                  Hình ảnh riêng cho SKU ({editSkuImages.length} ảnh):
                </Label>
                <MultiImagePicker
                  images={editSkuImages}
                  onChange={setEditSkuImages}
                  disabled={pending}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setEditingSku(null)} disabled={pending}>
              Hủy
            </Button>
            <Button onClick={handleSaveEditSku} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              Lưu thay đổi SKU
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Quản lý nhóm quy cách / trục thuộc tính */}
      <Dialog open={showManageAxes} onOpenChange={(open) => !open && setShowManageAxes(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              Cấu hình nhóm quy cách (Thuộc tính vật tư)
            </DialogTitle>
            <DialogDescription>
              Thiết lập các nhóm thuộc tính để phân loại SKU (ví dụ: Hãng sản xuất, Kích thước, Màu sắc, Độ dày...).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Gợi ý mẫu nhanh */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Gợi ý mẫu theo loại vật tư:</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_GROUPS.map((preset, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="xs"
                    className="text-xs"
                    onClick={() => setManageAxesList(preset.axes)}
                  >
                    + {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Danh sách các trục hiện tại */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Danh sách nhóm quy cách ({manageAxesList.length}/5):
              </Label>
              {manageAxesList.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  Chưa có nhóm quy cách nào. Bạn có thể thêm hoặc chọn mẫu gợi ý phía trên.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {manageAxesList.map((axisName, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-md border bg-muted/30 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          #{idx + 1}
                        </Badge>
                        <span className="font-medium">{axisName}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveAxisName(idx)}
                        title="Gỡ nhóm này"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Thêm nhóm tùy chỉnh */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Input
                placeholder="Nhập tên nhóm mới (VD: Công suất, Màu sắc...)"
                value={customAxisInput}
                onChange={(e) => setCustomAxisInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAxisName(customAxisInput);
                  }
                }}
                className="text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleAddAxisName(customAxisInput)}
                disabled={!customAxisInput.trim() || manageAxesList.length >= 5}
              >
                <Plus className="size-4 mr-1" /> Thêm
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowManageAxes(false)} disabled={pending}>
              Hủy
            </Button>
            <Button onClick={handleSaveAxes} disabled={pending || manageAxesList.length === 0}>
              {pending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              Lưu nhóm quy cách
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog chỉnh sửa đơn vị quy đổi (UOM) */}
      <Dialog open={Boolean(editingUom)} onOpenChange={(open) => !open && setEditingUom(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Scale className="size-4 text-primary" />
              Sửa đơn vị quy đổi
            </DialogTitle>
            <DialogDescription>
              Cập nhật tên gọi đóng gói, tỷ lệ quy đổi sang đơn vị chuẩn và mã vạch riêng.
            </DialogDescription>
          </DialogHeader>

          {editingUom && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Tên đơn vị đóng gói</Label>
                <Input
                  placeholder="VD: Thùng 24 lon, Bao 50kg..."
                  value={editUomDisplayName}
                  onChange={(e) => setEditUomDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Hệ số quy đổi (= ĐVT chuẩn)</Label>
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  value={editUomFactor}
                  onChange={(e) => setEditUomFactor(parseFloat(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-1">
                <Label>Mã vạch riêng (tùy chọn)</Label>
                <Input
                  placeholder="Mã vạch"
                  value={editUomBarcode}
                  onChange={(e) => setEditUomBarcode(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setEditingUom(null)} disabled={pending}>
              Hủy
            </Button>
            <Button onClick={handleSaveEditUom} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal chỉnh sửa hình ảnh riêng của SKU */}
      <Dialog open={Boolean(editingSkuForImages)} onOpenChange={(open) => !open && setEditingSkuForImages(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" />
              Hình ảnh cho SKU: <span className="font-mono text-primary">{editingSkuForImages?.skuCode}</span>
            </DialogTitle>
            <DialogDescription>
              Tải lên hoặc gỡ hình ảnh chi tiết dành riêng cho quy cách / SKU này.
            </DialogDescription>
          </DialogHeader>

          {editingSkuForImages && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <ImagePlus className="size-3.5 text-primary" />
                  Danh sách ảnh riêng ({skuImages.length} ảnh):
                </Label>
                <MultiImagePicker
                  images={skuImages}
                  onChange={setSkuImages}
                  disabled={pending}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setEditingSkuForImages(null)} disabled={pending}>
              Hủy
            </Button>
            <Button onClick={handleSaveSkuImages} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              Lưu hình ảnh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
