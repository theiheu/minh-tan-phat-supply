"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { returnToolBorrowing } from "../actions";
import { cn } from "@/lib/utils";

export interface ToolReturnItemInfo {
  variantId: string;
  name: string;
  detail?: string | null;
  unit?: string | null;
  quantity: number;
  returnedQuantity: number;
}

export interface ToolReturnDialogProps {
  borrowingId: string;
  code?: string;
  variantId?: string;
  productName?: string;
  variantLabel?: string | null;
  quantity?: number;
  returnedQuantity?: number;
  unit?: string | null;
  items?: ToolReturnItemInfo[];
  isManager?: boolean;
  trigger?: React.ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ToolReturnDialog({
  borrowingId,
  code,
  variantId,
  productName,
  variantLabel,
  quantity = 1,
  returnedQuantity = 0,
  unit,
  items: passedItems,
  isManager = false,
  trigger,
  triggerLabel,
  triggerClassName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSuccess,
}: ToolReturnDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? controlledOnOpenChange ?? (() => {}) : setInternalOpen;

  // Build item list
  const defaultItems: ToolReturnItemInfo[] = passedItems ?? [
    {
      variantId: variantId ?? "",
      name: productName ?? "Dụng cụ",
      detail: variantLabel,
      unit: unit ?? "cái",
      quantity,
      returnedQuantity,
    },
  ];

  // Map of variantId -> return quantity
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const item of defaultItems) {
      const remaining = Math.max(0, item.quantity - item.returnedQuantity);
      init[item.variantId] = remaining;
    }
    return init;
  });

  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const resetForm = () => {
    const init: Record<string, number> = {};
    for (const item of defaultItems) {
      const remaining = Math.max(0, item.quantity - item.returnedQuantity);
      init[item.variantId] = remaining;
    }
    setReturnQuantities(init);
    setNotes("");
  };

  const handleOpenChange = (open: boolean) => {
    if (open) resetForm();
    setIsOpen(open);
  };

  const handleQuantityChange = (vId: string, value: number, max: number) => {
    const clamped = Math.max(1, Math.min(value, max));
    setReturnQuantities((prev) => ({ ...prev, [vId]: clamped }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const itemsToReturn = defaultItems
      .filter((item) => (item.quantity - item.returnedQuantity) > 0)
      .map((item) => ({
        variantId: item.variantId,
        quantity: returnQuantities[item.variantId] ?? (item.quantity - item.returnedQuantity),
      }))
      .filter((i) => i.quantity > 0 && i.variantId);

    if (itemsToReturn.length === 0) {
      toast.error("Không có dụng cụ nào để trả");
      return;
    }

    startTransition(async () => {
      try {
        await returnToolBorrowing({
          borrowingId,
          items: itemsToReturn,
          notes: notes.trim() || undefined,
        });

        toast.success("Đã ghi nhận trả dụng cụ thành công");
        setIsOpen(false);
        router.refresh();
        onSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Trả dụng cụ thất bại");
      }
    });
  };

  const totalRemaining = defaultItems.reduce(
    (sum, item) => sum + Math.max(0, item.quantity - item.returnedQuantity),
    0,
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ? (
            trigger
          ) : (
            <Button
              type="button"
              variant={isManager ? "default" : "outline"}
              size="sm"
              className={cn("gap-1.5", triggerClassName)}
            >
              <RotateCcw className="size-3.5" />
              {triggerLabel || (isManager ? "Xác nhận nhận lại" : "Báo trả dụng cụ")}
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-5 text-primary" />
              Trả dụng cụ {code ? `(${code})` : ""}
            </DialogTitle>
            <DialogDescription>
              Xác nhận số lượng dụng cụ hoàn trả về kho. Có thể trả một phần hoặc toàn bộ.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {defaultItems.map((item) => {
              const remaining = Math.max(0, item.quantity - item.returnedQuantity);
              const currentReturnQty = returnQuantities[item.variantId] ?? remaining;

              return (
                <div
                  key={item.variantId || item.name}
                  className="p-3 rounded-lg border bg-muted/30 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{item.name}</div>
                      {item.detail && (
                        <div className="text-xs text-muted-foreground">{item.detail}</div>
                      )}
                    </div>
                    <div className="text-xs font-medium bg-secondary px-2 py-0.5 rounded text-secondary-foreground shrink-0">
                      Còn giữ: {remaining} {item.unit || ""}
                    </div>
                  </div>

                  {remaining > 0 ? (
                    <div className="flex items-center justify-between pt-1">
                      <Label htmlFor={`qty-${item.variantId}`} className="text-xs text-muted-foreground">
                        Số lượng trả:
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label="Giảm số lượng trả"
                          disabled={currentReturnQty <= 1 || pending}
                          onClick={() =>
                            handleQuantityChange(item.variantId, currentReturnQty - 1, remaining)
                          }
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Input
                          id={`qty-${item.variantId}`}
                          type="number"
                          min={1}
                          max={remaining}
                          value={currentReturnQty}
                          onChange={(e) =>
                            handleQuantityChange(
                              item.variantId,
                              parseInt(e.target.value, 10) || 1,
                              remaining,
                            )
                          }
                          className="w-16 h-7 text-center text-sm font-semibold px-1"
                          disabled={pending}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label="Tăng số lượng trả"
                          disabled={currentReturnQty >= remaining || pending}
                          onClick={() =>
                            handleQuantityChange(item.variantId, currentReturnQty + 1, remaining)
                          }
                        >
                          <Plus className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                          disabled={currentReturnQty === remaining || pending}
                          onClick={() =>
                            handleQuantityChange(item.variantId, remaining, remaining)
                          }
                        >
                          Trả hết
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-600 font-medium pt-1">
                      Đã hoàn trả đủ số lượng
                    </div>
                  )}
                </div>
              );
            })}

            <div className="space-y-1.5">
              <Label htmlFor="return-notes" className="text-xs font-medium">
                Ghi chú khi trả (tùy chọn)
              </Label>
              <Textarea
                id="return-notes"
                placeholder="Ghi chú tình trạng thiết bị khi trả (hoạt động tốt, phụ kiện đi kèm...)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
                rows={2}
                className="text-sm resize-none"
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
              disabled={pending || totalRemaining === 0}
              className="gap-1.5"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Xác nhận trả dụng cụ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
