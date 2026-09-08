"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Loader2, Minus, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ComboboxInput, type ComboboxInputOption } from "@/components/combobox-input";
import { createToolBorrowing } from "../actions";
import { cn } from "@/lib/utils";

export interface ToolBorrowVariantOption {
  id: string;
  name: string;
  detail?: string;
  unit?: string;
  availableStock?: number;
}

export interface ToolBorrowDialogProps {
  variants?: ToolBorrowVariantOption[];
  zones?: { id: string; name: string }[];
  borrowers?: { id: string; fullName: string; username?: string }[];
  isManager?: boolean;
  defaultVariantId?: string;
  defaultZoneId?: string;
  trigger?: React.ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: (borrowingId: string) => void;
}

function getFutureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ToolBorrowDialog({
  variants = [],
  zones = [],
  borrowers = [],
  isManager = false,
  defaultVariantId,
  defaultZoneId,
  trigger,
  triggerLabel = "Mượn dụng cụ",
  triggerClassName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSuccess,
}: ToolBorrowDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? controlledOnOpenChange ?? (() => {}) : setInternalOpen;

  const [variantId, setVariantId] = useState(defaultVariantId ?? (variants.length === 1 ? variants[0].id : ""));
  const [quantity, setQuantity] = useState("1");
  const [zoneId, setZoneId] = useState(defaultZoneId ?? "none");
  const [borrowerId, setBorrowerId] = useState("self");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedVariant = variants.find((v) => v.id === variantId);
  const maxStock = selectedVariant?.availableStock !== undefined ? selectedVariant.availableStock : 999;
  const numQty = Math.max(1, parseInt(quantity, 10) || 1);

  const variantOptions: ComboboxInputOption[] = variants.map((v) => ({
    value: v.id,
    label: v.name,
    detail: [v.detail, v.unit ? `ĐVT: ${v.unit}` : null].filter(Boolean).join(" · "),
    hint: v.availableStock !== undefined ? `Tồn: ${v.availableStock}` : undefined,
    text: v.detail ? `${v.name} (${v.detail})` : v.name,
  }));

  const resetForm = () => {
    setVariantId(defaultVariantId ?? (variants.length === 1 ? variants[0].id : ""));
    setQuantity("1");
    setZoneId(defaultZoneId ?? "none");
    setBorrowerId("self");
    setExpectedReturnDate("");
    setPurpose("");
  };

  const handleOpenChange = (open: boolean) => {
    if (open) resetForm();
    setIsOpen(open);
  };

  const handleSetPresetDays = (days: number) => {
    setExpectedReturnDate(getFutureDate(days));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!variantId) {
      toast.error("Vui lòng chọn dụng cụ cần mượn");
      return;
    }

    if (numQty <= 0) {
      toast.error("Số lượng mượn phải lớn hơn 0");
      return;
    }

    if (selectedVariant?.availableStock !== undefined && numQty > selectedVariant.availableStock) {
      toast.error(`Số lượng mượn không được vượt quá tồn kho khả dụng (${selectedVariant.availableStock})`);
      return;
    }

    if (!purpose.trim()) {
      toast.error("Vui lòng nhập mục đích mượn dụng cụ");
      return;
    }

    startTransition(async () => {
      try {
        const borrowingId = await createToolBorrowing({
          items: [{ variantId, quantity: numQty }],
          zoneId: zoneId !== "none" ? zoneId : undefined,
          purpose: purpose.trim(),
          expectedReturnDate: expectedReturnDate || undefined,
          borrowerId: isManager && borrowerId !== "self" ? borrowerId : undefined,
        });

        toast.success("Tạo phiếu mượn dụng cụ thành công");
        setIsOpen(false);
        router.refresh();
        onSuccess?.(borrowingId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo phiếu mượn thất bại");
      }
    });
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ? (
            trigger
          ) : (
            <Button className={cn("gap-1.5", triggerClassName)}>
              <Wrench className="size-4" />
              {triggerLabel}
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="size-5 text-primary" />
              Mượn dụng cụ / thiết bị
            </DialogTitle>
            <DialogDescription>
              Tạo phiếu mượn dụng cụ dùng chung. Quản lý kho sẽ theo dõi và tiếp nhận khi hoàn trả.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            {/* Tool Selection */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Dụng cụ / Thiết bị <span className="text-destructive">*</span>
              </Label>
              {variants.length > 0 ? (
                <ComboboxInput
                  value={variantId}
                  onChange={(val) => {
                    setVariantId(val);
                    setQuantity("1");
                  }}
                  options={variantOptions}
                  placeholder="Chọn dụng cụ cần mượn…"
                  emptyText="Không tìm thấy dụng cụ phù hợp."
                />
              ) : (
                <Input
                  placeholder="Chọn dụng cụ cần mượn…"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  disabled
                />
              )}
              {selectedVariant?.availableStock !== undefined && (
                <div className="text-xs text-muted-foreground">
                  Tồn kho khả dụng: <span className="font-semibold text-foreground">{selectedVariant.availableStock}</span> {selectedVariant.unit || "cái"}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label htmlFor="borrow-quantity" className="text-sm font-medium">
                Số lượng mượn <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0"
                  aria-label="Giảm số lượng"
                  disabled={numQty <= 1 || pending}
                  onClick={() => setQuantity(String(Math.max(1, numQty - 1)))}
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  id="borrow-quantity"
                  type="number"
                  min={1}
                  max={maxStock > 0 ? maxStock : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-24 text-center font-semibold text-base h-9"
                  disabled={pending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0"
                  aria-label="Tăng số lượng"
                  disabled={(maxStock > 0 && numQty >= maxStock) || pending}
                  onClick={() => setQuantity(String(Math.min(maxStock, numQty + 1)))}
                >
                  <Plus className="size-4" />
                </Button>
                {selectedVariant?.unit && (
                  <span className="text-sm text-muted-foreground">{selectedVariant.unit}</span>
                )}
              </div>
            </div>

            {/* Purpose */}
            <div className="space-y-1.5">
              <Label htmlFor="borrow-purpose" className="text-sm font-medium">
                Mục đích sử dụng <span className="text-destructive">*</span>
              </Label>
              <Input
                id="borrow-purpose"
                placeholder="VD: Hàn khung chuồng, sửa ống nước, thay bóng đèn..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            {/* Zone selection */}
            {zones.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="borrow-zone" className="text-sm font-medium">
                  Khu vực / Trại sử dụng
                </Label>
                <Select value={zoneId} onValueChange={setZoneId} disabled={pending}>
                  <SelectTrigger id="borrow-zone" className="w-full">
                    <SelectValue placeholder="Chọn khu vực (tùy chọn)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Không chọn khu vực --</SelectItem>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Borrower selection (for manager) */}
            {isManager && borrowers.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="borrow-user" className="text-sm font-medium">
                  Người mượn
                </Label>
                <Select value={borrowerId} onValueChange={setBorrowerId} disabled={pending}>
                  <SelectTrigger id="borrow-user" className="w-full">
                    <SelectValue placeholder="Bản thân mượn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">-- Bản thân tôi mượn --</SelectItem>
                    {borrowers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName || u.username || u.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Expected Return Date & Quick Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="expected-return-date" className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  Hạn dự kiến trả
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs font-normal"
                    onClick={() => handleSetPresetDays(1)}
                  >
                    +1 ngày
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs font-normal"
                    onClick={() => handleSetPresetDays(3)}
                  >
                    +3 ngày
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs font-normal"
                    onClick={() => handleSetPresetDays(7)}
                  >
                    +7 ngày
                  </Button>
                </div>
              </div>
              <Input
                id="expected-return-date"
                type="date"
                min={todayStr}
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                disabled={pending}
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={pending || !variantId || !purpose.trim()}
              className="gap-1.5"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Xác nhận mượn
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
