"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReceiptForm, type VariantOption } from "./receipt-form";

export function ReceiptDialog({
  suppliers,
  variants,
  triggerLabel = "Tạo phiếu đặt hàng / nhập kho",
  triggerClassName,
}: {
  suppliers: { id: string; name: string }[];
  variants: VariantOption[];
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>
          <Plus className="mr-1.5 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border-2 border-border shadow-2xl rounded-2xl">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="text-base font-semibold">Tạo phiếu đặt hàng / nhập kho</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Lập phiếu đặt hàng hoặc ghi nhận nhập kho từ nhà cung cấp.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2">
          <ReceiptForm
            suppliers={suppliers}
            variants={variants}
            onSuccess={(id) => {
              setOpen(false);
              router.push(`/receipts/${id}`);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
