"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Droplet,
  Droplets,
  Edit,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { FUEL_TYPE_PRESETS, formatFuelQuantity, type FuelTypePreset } from "@/lib/fuel";
import { createFuelTypeAction, deleteFuelTypeAction, toggleFuelTypeActiveAction } from "../actions";
import type { FuelType } from "../types";
import { FuelTypeDialog } from "./fuel-type-dialog";

export function FuelTypeList({
  fuelTypes,
}: {
  fuelTypes: FuelType[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editingType, setEditingType] = useState<FuelType | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // State for delete confirmation
  const [deletingType, setDeletingType] = useState<FuelType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const filteredTypes = useMemo(() => {
    return fuelTypes.filter((ft) => {
      if (statusFilter === "active" && !ft.is_active) return false;
      if (statusFilter === "inactive" && ft.is_active) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = ft.name.toLowerCase().includes(q);
        const matchesCode = ft.code.toLowerCase().includes(q);
        const matchesUnit = ft.unit.toLowerCase().includes(q);
        const matchesDesc = (ft.description || "").toLowerCase().includes(q);
        return matchesName || matchesCode || matchesUnit || matchesDesc;
      }
      return true;
    });
  }, [fuelTypes, searchTerm, statusFilter]);

  const totalCount = fuelTypes.length;
  const activeCount = fuelTypes.filter((f) => f.is_active).length;
  const lowStockCount = fuelTypes.filter((f) => f.is_active && Number(f.current_stock) <= Number(f.min_stock)).length;

  const handleEdit = (ft: FuelType) => {
    setEditingType(ft);
    setEditDialogOpen(true);
  };

  const handleToggleActive = (ft: FuelType) => {
    const nextState = !ft.is_active;
    startTransition(async () => {
      try {
        await toggleFuelTypeActiveAction(ft.id, nextState);
        toast.success(
          nextState
            ? `Đã kích hoạt loại "${ft.name}"`
            : `Đã ngưng sử dụng loại "${ft.name}"`
        );
      } catch (err: any) {
        toast.error(err?.message || "Không thể cập nhật trạng thái");
      }
    });
  };

  const handleDeleteConfirm = () => {
    if (!deletingType) return;
    startTransition(async () => {
      try {
        await deleteFuelTypeAction(deletingType.id);
        toast.success(`Đã xóa loại "${deletingType.name}" thành công`);
        setDeleteDialogOpen(false);
        setDeletingType(null);
      } catch (err: any) {
        toast.error(err?.message || "Không thể xóa loại nhiên liệu");
      }
    });
  };

  const handleQuickCreatePreset = (preset: FuelTypePreset) => {
    startTransition(async () => {
      try {
        await createFuelTypeAction({
          name: preset.name,
          code: preset.code,
          unit: preset.unit,
          minStock: preset.minStock,
          description: preset.description,
        });
        toast.success(`Đã tạo nhanh "${preset.name}" thành công!`);
      } catch (err: any) {
        toast.error(err?.message || "Lỗi tạo loại nhiên liệu");
      }
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Danh mục Loại Dầu & Nhiên liệu</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Quản lý các loại Dầu Diesel, Nhớt động cơ, Nước làm mát, Dầu thủy lực, Xăng...
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow text-xs sm:text-sm h-9 gap-1.5"
          >
            <Plus className="size-4" />
            Thêm loại dầu / nhớt
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-3">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3 sm:p-5">
            <CardTitle className="text-xs sm:text-sm font-medium">Tổng danh mục</CardTitle>
            <Droplets className="size-3.5 sm:size-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {totalCount} <span className="text-xs font-normal text-muted-foreground">loại</span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
              {activeCount} loại đang hoạt động
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3 sm:p-5">
            <CardTitle className="text-xs sm:text-sm font-medium">Đang sử dụng</CardTitle>
            <CheckCircle2 className="size-3.5 sm:size-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-blue-600">{activeCount}</div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">Khả dụng cho xuất/nhập</p>
          </CardContent>
        </Card>

        <Card className={lowStockCount > 0 ? "border-destructive/40 bg-destructive/5 col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-1"}>
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3 sm:p-5">
            <CardTitle className="text-xs sm:text-sm font-medium">Cảnh báo tồn kho</CardTitle>
            <AlertTriangle className={`size-3.5 sm:size-4 ${lowStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <div className={`text-lg sm:text-2xl font-bold ${lowStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {lowStockCount} <span className="text-xs font-normal text-muted-foreground">loại sắp hết</span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
              {lowStockCount > 0 ? "Tồn kho dưới mức an toàn" : "Tất cả đều đủ tồn kho"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo tên loại, mã phân loại, ghi chú..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs sm:text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[150px] h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="active">Đang sử dụng</SelectItem>
                  <SelectItem value="inactive">Ngưng sử dụng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fuel Types Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px] text-xs font-semibold">Mã loại</TableHead>
                <TableHead className="text-xs font-semibold">Tên loại dầu / nhiên liệu</TableHead>
                <TableHead className="w-[80px] text-xs font-semibold text-center">ĐVT</TableHead>
                <TableHead className="w-[140px] text-xs font-semibold text-right">Tồn kho hiện tại</TableHead>
                <TableHead className="w-[130px] text-xs font-semibold text-right">Mức tối thiểu</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold text-center">Trạng thái</TableHead>
                <TableHead className="text-xs font-semibold">Ghi chú / Quy cách</TableHead>
                <TableHead className="w-[130px] text-xs font-semibold text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-44 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="rounded-full bg-muted p-3">
                        <Droplet className="size-6 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">
                          {searchTerm || statusFilter !== "all"
                            ? "Không tìm thấy loại nhiên liệu phù hợp"
                            : "Chưa có loại nhiên liệu nào trong hệ thống"}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          {searchTerm || statusFilter !== "all"
                            ? "Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái."
                            : "Nhấn nút dưới đây để tạo loại mới hoặc chọn từ các mẫu thông dụng."}
                        </p>
                      </div>

                      {(!searchTerm && statusFilter === "all") && (
                        <div className="space-y-2.5 pt-2">
                          <Button
                            size="sm"
                            onClick={() => setCreateDialogOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                          >
                            <Plus className="size-4" />
                            Tạo loại dầu đầu tiên
                          </Button>

                          <div className="pt-2 border-t max-w-md mx-auto">
                            <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center justify-center gap-1">
                              <Sparkles className="size-3 text-amber-500" /> Tạo nhanh từ mẫu có sẵn:
                            </p>
                            <div className="flex flex-wrap justify-center gap-1.5">
                              {FUEL_TYPE_PRESETS.slice(0, 4).map((p) => (
                                <button
                                  key={p.code}
                                  type="button"
                                  onClick={() => handleQuickCreatePreset(p)}
                                  disabled={pending}
                                  className="rounded border border-dashed bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-primary/10 hover:border-primary transition-colors"
                                >
                                  + {p.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTypes.map((ft) => {
                  const isLow = ft.is_active && Number(ft.current_stock) <= Number(ft.min_stock);
                  return (
                    <TableRow key={ft.id} className={!ft.is_active ? "opacity-60 bg-muted/20" : ""}>
                      <TableCell className="font-mono text-xs font-medium">
                        {ft.code}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-xs sm:text-sm">{ft.name}</span>
                          {isLow && (
                            <Badge variant="danger" className="text-[9px] px-1 py-0 gap-0.5 shrink-0">
                              <AlertTriangle className="size-2.5" /> Sắp hết
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-normal">
                          {ft.unit}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-semibold text-xs sm:text-sm ${
                            isLow
                              ? "text-destructive"
                              : Number(ft.current_stock) > 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatFuelQuantity(Number(ft.current_stock), ft.unit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatFuelQuantity(Number(ft.min_stock), ft.unit)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={ft.is_active ? "success" : "secondary"}
                          className="text-[10px] sm:text-[11px] font-normal"
                        >
                          {ft.is_active ? "Đang sử dụng" : "Ngưng dùng"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                        {ft.description || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Chỉnh sửa"
                            onClick={() => handleEdit(ft)}
                          >
                            <Edit className="size-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title={ft.is_active ? "Ngưng sử dụng" : "Kích hoạt lại"}
                            onClick={() => handleToggleActive(ft)}
                            disabled={pending}
                          >
                            {ft.is_active ? (
                              <PowerOff className="size-3.5 text-amber-600 hover:text-amber-700" />
                            ) : (
                              <Power className="size-3.5 text-emerald-600 hover:text-emerald-700" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            title="Xóa loại nhiên liệu"
                            onClick={() => {
                              setDeletingType(ft);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={pending}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Controlled Edit & Create Dialogs */}
      <FuelTypeDialog
        mode="create"
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <FuelTypeDialog
        mode="edit"
        fuelType={editingType}
        open={editDialogOpen}
        onOpenChange={(v) => {
          setEditDialogOpen(v);
          if (!v) setEditingType(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Xác nhận xóa loại nhiên liệu
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Bạn có chắc chắn muốn xóa loại nhiên liệu{" "}
              <strong className="text-foreground">&ldquo;{deletingType?.name}&rdquo;</strong> (Mã:{" "}
              <span className="font-mono">{deletingType?.code}</span>)?
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto py-3 overscroll-contain">
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              Lưu ý: Chỉ có thể xóa loại nhiên liệu khi chưa từng phát sinh phiếu nhập kho, phiếu cấp phát hoặc liên kết với phương tiện.
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={pending}
              className="gap-1.5"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Xác nhận xóa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
