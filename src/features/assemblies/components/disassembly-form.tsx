"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, PackageMinus, RefreshCw } from "lucide-react";
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
import { executeDisassembly, getSkuBomDetails } from "../actions";
import type { DisassemblyItemRowState, SkuBomDetails, StockLocationOption } from "../types";

interface DisassemblyFormProps {
  locations: StockLocationOption[];
}

export function DisassemblyForm({ locations }: DisassemblyFormProps) {
  const [isPending, startTransition] = useTransition();
  const [_isLoadingBom, setIsLoadingBom] = useState(false);

  // Form State
  const [kitSkuId, setKitSkuId] = useState("");
  const [bomVersionId, setBomVersionId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [fromLocationId, setFromLocationId] = useState(locations[0]?.id || "");
  const [notes, setNotes] = useState("");

  // Loaded BOM details
  const [bomDetails, setBomDetails] = useState<SkuBomDetails | null>(null);

  // Items State for Disassembly Breakdown
  const [itemRows, setItemRows] = useState<DisassemblyItemRowState[]>([]);

  const numQty = Math.max(0, Number(quantity) || 0);

  // Load BOM details
  useEffect(() => {
    if (!kitSkuId) {
      setBomDetails(null);
      setBomVersionId("");
      setItemRows([]);
      return;
    }

    let isMounted = true;
    setIsLoadingBom(true);

    getSkuBomDetails(kitSkuId, fromLocationId, bomVersionId || undefined)
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
  }, [kitSkuId, bomVersionId, fromLocationId]);

  // Sync item rows when bomDetails.items or quantity changes
  useEffect(() => {
    if (!bomDetails || bomDetails.items.length === 0) {
      setItemRows([]);
      return;
    }

    const defaultLoc = fromLocationId || locations[0]?.id || "";

    setItemRows((prev) =>
      bomDetails.items.map((bItem) => {
        const expected = Number((bItem.baseQuantity * numQty).toFixed(4));
        const existing = prev.find((p) => p.componentSkuId === bItem.componentSkuId);

        const rec = existing ? existing.recoveredQuantity : expected;
        const dam = existing ? existing.damagedQuantity : 0;
        const lost = existing ? existing.lostQuantity : 0;
        const total = rec + dam + lost;
        const isValid = Math.abs(total - expected) < 0.00001;

        return {
          componentSkuId: bItem.componentSkuId,
          componentSkuCode: bItem.componentSkuCode,
          componentProductName: bItem.componentProductName,
          componentSummary: bItem.componentSummary,
          baseUnitSymbol: bItem.baseUnitSymbol,
          baseQuantityPerUnit: bItem.baseQuantity,
          expectedQuantity: expected,
          recoveredQuantity: rec,
          damagedQuantity: dam,
          lostQuantity: lost,
          recoveryLocationId: existing?.recoveryLocationId || defaultLoc,
          damagedLocationId: existing?.damagedLocationId || defaultLoc,
          isValid,
          totalAllocated: total,
        };
      })
    );
  }, [bomDetails, numQty, fromLocationId, locations]);

  function updateRow(index: number, patch: Partial<DisassemblyItemRowState>) {
    setItemRows((rows) =>
      rows.map((row, idx) => {
        if (idx !== index) return row;
        const updated = { ...row, ...patch };
        const total = updated.recoveredQuantity + updated.damagedQuantity + updated.lostQuantity;
        const isValid = Math.abs(total - updated.expectedQuantity) < 0.00001;
        return {
          ...updated,
          totalAllocated: total,
          isValid,
        };
      })
    );
  }

  const allItemsValid =
    itemRows.length > 0 &&
    itemRows.every(
      (r) =>
        r.isValid &&
        (r.damagedQuantity <= 0 || Boolean(r.damagedLocationId)) &&
        Boolean(r.recoveryLocationId)
    );

  const canSubmit =
    Boolean(kitSkuId) &&
    Boolean(bomVersionId) &&
    numQty > 0 &&
    Boolean(fromLocationId) &&
    allItemsValid;

  function handleAutoDistributeAll() {
    setItemRows((rows) =>
      rows.map((row) => ({
        ...row,
        recoveredQuantity: row.expectedQuantity,
        damagedQuantity: 0,
        lostQuantity: 0,
        totalAllocated: row.expectedQuantity,
        isValid: true,
      }))
    );
    toast.success("Đã phân bổ 100% thu hồi đạt chuẩn cho tất cả linh kiện");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        const res = await executeDisassembly({
          kitSkuId,
          bomVersionId,
          quantity: numQty,
          fromLocationId,
          items: itemRows.map((r) => ({
            componentSkuId: r.componentSkuId,
            recoveredQuantity: r.recoveredQuantity,
            damagedQuantity: r.damagedQuantity,
            lostQuantity: r.lostQuantity,
            recoveryLocationId: r.recoveryLocationId,
            damagedLocationId: r.damagedQuantity > 0 ? r.damagedLocationId : null,
          })),
          notes: notes.trim() || undefined,
        });

        toast.success("Tháo dỡ thành phẩm thành công!", {
          description: `Đã hoàn tất tháo bộ và ghi nhận thu hồi linh kiện. Mã: ${res.movementId}`,
        });

        setQuantity("1");
        setNotes("");
        if (kitSkuId) {
          const updated = await getSkuBomDetails(kitSkuId, fromLocationId, bomVersionId);
          setBomDetails(updated);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Thao tác tháo dỡ thất bại.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Form Configuration */}
        <div className="space-y-6 lg:col-span-4">
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                <PackageMinus className="size-4" />
                <span>Thiết lập lệnh tháo dỡ</span>
              </div>
              <CardTitle className="text-lg">Chọn bộ tháo dỡ & Kho nguồn</CardTitle>
              <CardDescription>
                Tháo dỡ bộ thành phẩm để thu hồi hoặc ghi nhận hư hại theo định mức BOM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* SKU Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">SKU Bộ thành phẩm (Stocked Assembly) *</Label>
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
                  <Label className="text-xs font-semibold">Phiên bản BOM tháo dỡ</Label>
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
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quantity to disassemble */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Số lượng bộ cần tháo dỡ *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="VD: 5"
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

              {/* From Stock Location */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Kho xuất bộ thành phẩm để tháo *</Label>
                <Select value={fromLocationId} onValueChange={setFromLocationId}>
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
                {bomDetails && (
                  <div className="text-[11px] text-muted-foreground pt-0.5">
                    Tồn thành phẩm tại kho này: <span className="font-semibold text-foreground">{bomDetails.onHandQuantity} {bomDetails.baseUnitSymbol}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ghi chú (tùy chọn)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Tháo thu hồi phụ tùng máy bơm..."
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
                      Đang xử lý tháo dỡ & cập nhật tồn kho...
                    </>
                  ) : (
                    <>
                      <PackageMinus className="size-4" />
                      Xác nhận Tháo dỡ ({numQty} {bomDetails?.baseUnitSymbol || "bộ"})
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Components Breakdown Table */}
        <div className="space-y-6 lg:col-span-8">
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary font-medium text-sm">
                  <RefreshCw className="size-4" />
                  <span>Phân bổ kết quả thu hồi linh kiện</span>
                </div>
                <CardTitle className="text-lg mt-1">Định mức & Tình trạng thu hồi</CardTitle>
                <CardDescription>
                  Tổng Thu hồi + Hỏng + Thất thoát phải khớp đúng định mức BOM ({numQty} bộ).
                </CardDescription>
              </div>
              {itemRows.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoDistributeAll}
                  className="text-xs h-8"
                >
                  Gán 100% Thu hồi
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!kitSkuId ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <PackageMinus className="size-10 stroke-[1.5] mb-2 opacity-50" />
                  <p className="text-sm font-medium">Vui lòng chọn bộ thành phẩm để phân bổ linh kiện tháo dỡ.</p>
                </div>
              ) : itemRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <AlertCircle className="size-10 text-amber-500 mb-2" />
                  <p className="text-sm font-medium text-foreground">Không có linh kiện trong BOM đã chọn.</p>
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-xs font-semibold min-w-[160px]">Linh kiện</TableHead>
                          <TableHead className="text-xs font-semibold text-right min-w-[70px]">Định mức</TableHead>
                          <TableHead className="text-xs font-semibold min-w-[130px]">Thu hồi đạt</TableHead>
                          <TableHead className="text-xs font-semibold min-w-[130px]">Kho thu hồi</TableHead>
                          <TableHead className="text-xs font-semibold min-w-[110px]">Hư hỏng</TableHead>
                          <TableHead className="text-xs font-semibold min-w-[130px]">Kho hàng hỏng</TableHead>
                          <TableHead className="text-xs font-semibold min-w-[90px]">Thất thoát</TableHead>
                          <TableHead className="text-xs font-semibold text-center min-w-[90px]">Kiểm tra</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemRows.map((row, idx) => (
                          <TableRow key={row.componentSkuId} className={!row.isValid ? "bg-amber-50/40 dark:bg-amber-950/20" : undefined}>
                            {/* Component Name & Code */}
                            <TableCell className="py-2.5">
                              <div className="font-medium text-sm leading-tight">{row.componentProductName}</div>
                              <div className="font-mono text-xs text-muted-foreground">{row.componentSkuCode}</div>
                            </TableCell>

                            {/* BOM Expected Qty */}
                            <TableCell className="text-right py-2.5 font-mono text-xs font-semibold">
                              {row.expectedQuantity} {row.baseUnitSymbol}
                            </TableCell>

                            {/* Recovered Quantity */}
                            <TableCell className="py-2.5">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={row.recoveredQuantity}
                                onChange={(e) =>
                                  updateRow(idx, { recoveredQuantity: Math.max(0, Number(e.target.value) || 0) })
                                }
                                className="h-8 font-mono text-xs"
                              />
                            </TableCell>

                            {/* Recovery Location */}
                            <TableCell className="py-2.5">
                              <Select
                                value={row.recoveryLocationId}
                                onValueChange={(val) => updateRow(idx, { recoveryLocationId: val })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {locations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id} className="text-xs">
                                      {loc.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Damaged Quantity */}
                            <TableCell className="py-2.5">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={row.damagedQuantity}
                                onChange={(e) =>
                                  updateRow(idx, { damagedQuantity: Math.max(0, Number(e.target.value) || 0) })
                                }
                                className="h-8 font-mono text-xs"
                              />
                            </TableCell>

                            {/* Damaged Location */}
                            <TableCell className="py-2.5">
                              <Select
                                value={row.damagedLocationId}
                                onValueChange={(val) => updateRow(idx, { damagedLocationId: val })}
                                disabled={row.damagedQuantity <= 0}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Chọn kho" />
                                </SelectTrigger>
                                <SelectContent>
                                  {locations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id} className="text-xs">
                                      {loc.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Lost Quantity */}
                            <TableCell className="py-2.5">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={row.lostQuantity}
                                onChange={(e) =>
                                  updateRow(idx, { lostQuantity: Math.max(0, Number(e.target.value) || 0) })
                                }
                                className="h-8 font-mono text-xs"
                              />
                            </TableCell>

                            {/* Verification Badge */}
                            <TableCell className="text-center py-2.5">
                              {row.isValid ? (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-[11px] gap-1 whitespace-nowrap">
                                  <CheckCircle2 className="size-3" />
                                  Khớp
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[11px] whitespace-nowrap" title={`Tổng: ${row.totalAllocated} / Cần: ${row.expectedQuantity}`}>
                                  Lệch ({row.totalAllocated}/{row.expectedQuantity})
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
