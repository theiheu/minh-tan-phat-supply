"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Layers, Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SkuSelector } from "@/features/catalog/components/sku-selector";
import { executeAssembly, getSkuBomDetails } from "../actions";
import type { SkuBomDetails, StockLocationOption } from "../types";

interface AssemblyFormProps {
  locations: StockLocationOption[];
}

export function AssemblyForm({ locations }: AssemblyFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isLoadingBom, setIsLoadingBom] = useState(false);

  // Form State
  const [kitSkuId, setKitSkuId] = useState("");
  const [bomVersionId, setBomVersionId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [componentLocationId, setComponentLocationId] = useState(locations[0]?.id || "");
  const [finishedLocationId, setFinishedLocationId] = useState(locations[0]?.id || "");
  const [notes, setNotes] = useState("");

  // Loaded BOM details
  const [bomDetails, setBomDetails] = useState<SkuBomDetails | null>(null);

  // Load BOM details when SKU, Version or Component Location changes
  useEffect(() => {
    if (!kitSkuId) {
      setBomDetails(null);
      setBomVersionId("");
      return;
    }

    let isMounted = true;
    setIsLoadingBom(true);

    getSkuBomDetails(kitSkuId, componentLocationId, bomVersionId || undefined)
      .then((details) => {
        if (!isMounted) return;
        setBomDetails(details);
        if (details?.selectedVersionId && (!bomVersionId || bomVersionId !== details.selectedVersionId)) {
          setBomVersionId(details.selectedVersionId);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("Không thể tải thông tin BOM: " + (err instanceof Error ? err.message : ""));
      })
      .finally(() => {
        if (isMounted) setIsLoadingBom(false);
      });

    return () => {
      isMounted = false;
    };
  }, [kitSkuId, bomVersionId, componentLocationId]);

  const numQty = Math.max(0, Number(quantity) || 0);

  // Calculate items requirement based on quantity
  const itemsWithReq = (bomDetails?.items || []).map((item) => {
    const required = Number((item.baseQuantity * numQty * (1 + item.wastagePercent / 100)).toFixed(4));
    const isAvailable = item.availableOnHand >= required;
    return {
      ...item,
      calculatedRequired: required,
      isAvailable,
      shortage: Math.max(0, required - item.availableOnHand),
    };
  });

  const hasShortage = itemsWithReq.some((item) => !item.isAvailable && item.calculatedRequired > 0);
  const canSubmit =
    Boolean(kitSkuId) &&
    Boolean(bomVersionId) &&
    numQty > 0 &&
    Boolean(componentLocationId) &&
    Boolean(finishedLocationId) &&
    (bomDetails?.items.length || 0) > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        const res = await executeAssembly({
          kitSkuId,
          bomVersionId,
          quantity: numQty,
          componentLocationId,
          finishedLocationId,
          notes: notes.trim() || undefined,
        });

        toast.success("Lắp ráp thành phẩm thành công!", {
          description: `Giao dịch hoàn tất. Mã phát sinh: ${res.movementId}`,
        });

        // Reset or refresh data
        setQuantity("1");
        setNotes("");
        // Trigger reload of stock
        if (kitSkuId) {
          const updated = await getSkuBomDetails(kitSkuId, componentLocationId, bomVersionId);
          setBomDetails(updated);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác lắp ráp thất bại.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Form Configuration */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                <PackagePlus className="size-4" />
                <span>Thiết lập lệnh lắp ráp</span>
              </div>
              <CardTitle className="text-lg">Chọn bộ thành phẩm & Thông số</CardTitle>
              <CardDescription>
                Chọn SKU có chính sách ráp sẵn (stocked_assembly) để lấy định mức BOM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* SKU Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">SKU Thành phẩm (Stocked Assembly) *</Label>
                <SkuSelector
                  value={kitSkuId}
                  requireInventoryPolicy="stocked_assembly"
                  onSelect={(sku) => {
                    setKitSkuId(sku.skuId);
                    setBomVersionId("");
                  }}
                />
              </div>

              {/* BOM Version Selector */}
              {bomDetails && bomDetails.versions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Phiên bản BOM</Label>
                  <Select
                    value={bomVersionId}
                    onValueChange={setBomVersionId}
                    disabled={bomDetails.versions.length <= 1}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn phiên bản BOM" />
                    </SelectTrigger>
                    <SelectContent>
                      {bomDetails.versions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          Phiên bản {v.versionNumber} ({v.status === "active" ? "Đang áp dụng" : v.status})
                          {v.changeReason ? ` - ${v.changeReason}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quantity */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Số lượng lắp ráp *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="VD: 10"
                    className="font-mono text-base"
                    required
                  />
                  {bomDetails && (
                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      {bomDetails.baseUnitSymbol || "bộ"}
                    </span>
                  )}
                </div>
              </div>

              {/* Stock Locations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Kho xuất linh kiện *</Label>
                  <Select
                    value={componentLocationId}
                    onValueChange={setComponentLocationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn kho nguồn" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Kho nhập thành phẩm *</Label>
                  <Select
                    value={finishedLocationId}
                    onValueChange={setFinishedLocationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn kho đích" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-semibold">Ghi chú (tùy chọn)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Lắp ráp đợt 1 phục vụ xuất trại..."
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={!canSubmit || isPending}
                  className="w-full h-11 text-sm font-semibold gap-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Đang xử lý xuất linh kiện & nhập thành phẩm...
                    </>
                  ) : (
                    <>
                      <PackagePlus className="size-4" />
                      Xác nhận Lắp ráp ({numQty} {bomDetails?.baseUnitSymbol || "bộ"})
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: BOM Components & Availability Table */}
        <div className="space-y-6 lg:col-span-7">
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary font-medium text-sm">
                  <Layers className="size-4" />
                  <span>Định mức linh kiện & Khả dụng tồn kho</span>
                </div>
                <CardTitle className="text-lg mt-1">Chi tiết cấu thành BOM</CardTitle>
              </div>
              {isLoadingBom && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Đang tính toán tồn kho...
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!kitSkuId ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <Layers className="size-10 stroke-[1.5] mb-2 opacity-50" />
                  <p className="text-sm font-medium">Vui lòng chọn SKU thành phẩm để xem danh sách linh kiện BOM.</p>
                </div>
              ) : itemsWithReq.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <AlertCircle className="size-10 text-amber-500 mb-2" />
                  <p className="text-sm font-medium text-foreground">SKU này chưa được cấu hình định mức BOM.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vui lòng cấu hình phiên bản BOM hoạt động trong phần quản lý danh mục vật tư.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {hasShortage && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200 text-xs">
                      <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <span className="font-semibold">Cảnh báo tồn kho linh kiện:</span> Một số linh kiện không đủ số lượng tại kho nguồn đã chọn. Hãy kiểm tra lại tồn kho trước khi thực hiện.
                      </div>
                    </div>
                  )}

                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Linh kiện</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Định mức/bộ</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Hao hụt</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Cần xuất</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Khả dụng</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemsWithReq.map((item) => (
                          <TableRow key={item.id} className={!item.isAvailable ? "bg-red-50/30 dark:bg-red-950/10" : undefined}>
                            <TableCell className="py-2.5">
                              <div className="font-medium text-sm">{item.componentProductName}</div>
                              <div className="font-mono text-xs text-muted-foreground">{item.componentSkuCode}</div>
                            </TableCell>
                            <TableCell className="text-right py-2.5 font-mono text-xs">
                              {item.baseQuantity} {item.baseUnitSymbol}
                            </TableCell>
                            <TableCell className="text-right py-2.5 font-mono text-xs text-muted-foreground">
                              {item.wastagePercent > 0 ? `+${item.wastagePercent}%` : "0%"}
                            </TableCell>
                            <TableCell className="text-right py-2.5 font-mono text-xs font-semibold">
                              {item.calculatedRequired} {item.baseUnitSymbol}
                            </TableCell>
                            <TableCell className="text-right py-2.5 font-mono text-xs">
                              {item.availableOnHand} {item.baseUnitSymbol}
                            </TableCell>
                            <TableCell className="text-center py-2.5">
                              {item.isAvailable ? (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-[11px] gap-1">
                                  <CheckCircle2 className="size-3" />
                                  Đủ
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[11px] gap-1">
                                  <AlertCircle className="size-3" />
                                  Thiếu {item.shortage}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-1">
                    <div>Tổng số loại linh kiện cấu thành: <span className="font-semibold text-foreground">{itemsWithReq.length}</span></div>
                    <div>Tồn thành phẩm hiện tại: <span className="font-semibold text-foreground">{bomDetails?.onHandQuantity || 0} {bomDetails?.baseUnitSymbol}</span></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
