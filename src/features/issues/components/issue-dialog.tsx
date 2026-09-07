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
import { IssueForm } from "./issue-form";

export function IssueDialog({
  zones,
  customers,
  variants,
  triggerLabel = "Tạo phiếu xuất",
  triggerClassName,
}: {
  zones: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  variants: {
    id: string;
    name: string;
    detail: string;
    isTrackableLot: boolean;
    price: number | null;
  }[];
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
      <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl h-[92svh] max-h-[92svh] sm:h-auto sm:max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden border-2 border-border shadow-2xl rounded-2xl">
        <DialogHeader className="shrink-0 pb-2 border-b">
          <DialogTitle className="text-base font-semibold">Tạo phiếu xuất kho</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Lập phiếu xuất vật tư cho khu nội bộ hoặc bán cho khách hàng.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-2 pr-1">
          <IssueForm
            zones={zones}
            customers={customers}
            variants={variants}
            onSuccess={(id) => {
              setOpen(false);
              router.push(`/issues/${id}`);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
