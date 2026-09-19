"use client";

import { useEffect, useState, useTransition } from "react";
import { Droplet, Edit, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FUEL_TYPE_PRESETS, generateFuelTypeCode, type FuelTypePreset } from "@/lib/fuel";
import { createFuelTypeAction, updateFuelTypeAction } from "../actions";
import type { FuelType } from "../types";

const COMMON_UNITS = ["lít", "can", "phuy", "thùng", "kg", "chai", "bình", "tuýp"];

export interface FuelTypeDialogProps {
  mode?: "create" | "edit";
  fuelType?: FuelType | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  onSaved?: (saved: FuelType) => void;
}

export function FuelTypeDialog({
  mode = "create",
  fuelType = null,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  onSaved,
}: FuelTypeDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  const [pending, startTransition] = useTransition();

  const isEdit = mode === "edit" || !!fuelType;

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("lít");
  const [minStock, setMinStock] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [description, setDescription] = useState("");
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  // Initialize or reset form when dialog opens or fuelType changes
  useEffect(() => {
    if (open) {
      if (isEdit && fuelType) {
        setName(fuelType.name ?? "");
        setCode(fuelType.code ?? "");
        setUnit(fuelType.unit || "lít");
        setMinStock(String(fuelType.min_stock ?? 0));
        setInitialStock("");
        setDescription(fuelType.description ?? "");
        setCodeManuallyEdited(true);
      } else {
        setName("");
        setCode("");
        setUnit("lít");
        setMinStock("0");
        setInitialStock("0");
        setDescription("");
        setCodeManuallyEdited(false);
      }
    }
  }, [open, isEdit, fuelType]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEdit && !codeManuallyEdited) {
      setCode(generateFuelTypeCode(val));
    }
  };

  const applyPreset = (preset: FuelTypePreset) => {
    setName(preset.name);
    setCode(preset.code);
    setUnit(preset.unit);
    setMinStock(String(preset.minStock));
    setDescription(preset.description);
    setCodeManuallyEdited(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên loại nhiên liệu/dầu");
      return;
    }
    if (!code.trim()) {
      toast.error("Vui lòng nhập mã loại nhiên liệu");
      return;
    }

    startTransition(async () => {
      try {
        if (isEdit && fuelType) {
          const res = await updateFuelTypeAction(fuelType.id, {
            name: name.trim(),
            code: code.trim().toUpperCase(),
            unit: unit.trim() || "lít",
            minStock: Number(minStock) || 0,
            description: description.trim() || undefined,
          });
          toast.success(`Đã cập nhật loại "${name.trim()}" thành công`);
          setOpen(false);
          onSaved?.(res as FuelType);
        } else {
          const res = await createFuelTypeAction({
            name: name.trim(),
            code: code.trim().toUpperCase(),
            unit: unit.trim() || "lít",
            minStock: Number(minStock) || 0,
            initialStock: Number(initialStock) || 0,
            description: description.trim() || undefined,
          });
          toast.success(`Đã tạo loại "${name.trim()}" thành công`);
          setOpen(false);
          onSaved?.(res as FuelType);
        }
      } catch (err: any) {
        toast.error(err?.message || "Có lỗi xảy ra khi lưu loại nhiên liệu");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !isControlled ? (
        <DialogTrigger asChild>
          <Button size="sm" variant={isEdit ? "ghost" : "default"} className={!isEdit ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}>
            {isEdit ? <Edit className="size-4" /> : <Plus className="mr-1.5 size-4" />}
            {isEdit ? "Sửa" : "Thêm loại dầu"}
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Droplet className="size-5 text-emerald-600" />
              {isEdit ? "Chỉnh sửa loại nhiên liệu / dầu nhớt" : "Thêm loại nhiên liệu / dầu nhớt / nước mát"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {isEdit
                ? "Cập nhật tên, mã, đơn vị tính và định mức tồn kho an toàn."
                : "Khai báo loại dầu, nhớt động cơ, nước làm mát, dầu thủy lực... để quản lý tồn kho và cấp phát."}
            </DialogDescription>
          </DialogHeader>

          {/* Quick Suggestions / Presets (Only in Create Mode) */}
          {!isEdit && (
            <div className="rounded-lg border bg-muted/40 p-2.5 sm:p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Sparkles className="size-3.5 text-amber-500" />
                <span>Gợi ý mẫu thông dụng (bấm để chọn nhanh):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FUEL_TYPE_PRESETS.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="inline-flex items-center rounded-md border border-border/80 bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3.5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fuel-name" className="text-xs sm:text-sm font-semibold">
                Tên loại nhiên liệu / dầu / chất lỏng <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fuel-name"
                placeholder="VD: Dầu Diesel DO 0.05S-II, Nhớt động cơ 15W40, Nước làm mát Coolant..."
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                autoFocus={!isEdit}
                className="h-9 text-sm"
              />
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="fuel-code" className="text-xs sm:text-sm font-semibold">
                  Mã phân loại (Code) <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] text-muted-foreground font-mono">Chữ in hoa, số & gạch dưới</span>
              </div>
              <Input
                id="fuel-code"
                placeholder="VD: DIESEL_DO_005, NHOT_15W40, NUOC_MAT, THUY_LUC_68..."
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setCodeManuallyEdited(true);
                }}
                required
                className="h-9 font-mono text-sm uppercase"
              />
            </div>

            {/* Unit */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="fuel-unit" className="text-xs sm:text-sm font-semibold">
                  Đơn vị tính (ĐVT) <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-wrap gap-1">
                  {COMMON_UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                        unit.toLowerCase() === u
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                id="fuel-unit"
                placeholder="VD: lít, can, phuy, thùng, kg..."
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>

            {/* Stocks: Initial Stock & Min Stock */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {!isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="fuel-initial-stock" className="text-xs sm:text-sm font-semibold">
                    Tồn kho ban đầu ({unit || "lít"})
                  </Label>
                  <Input
                    id="fuel-initial-stock"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Nhập số lượng thực tế hiện có trong kho.</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="fuel-min-stock" className="text-xs sm:text-sm font-semibold">
                  Mức tồn tối thiểu ({unit || "lít"})
                </Label>
                <Input
                  id="fuel-min-stock"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Cảnh báo khi tồn kho giảm xuống dưới mức này.</p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="fuel-desc" className="text-xs sm:text-sm font-semibold">
                Ghi chú / Quy cách / Ứng dụng
              </Label>
              <Textarea
                id="fuel-desc"
                placeholder="VD: Dùng cho xe ben Howo, xe xúc Komatsu; cấp độ nhớt SAE 15W-40 API CI-4..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none text-xs sm:text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="h-9"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  {isEdit ? <Droplet className="size-4" /> : <Plus className="size-4" />}
                  {isEdit ? "Cập nhật" : "Tạo loại dầu"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
