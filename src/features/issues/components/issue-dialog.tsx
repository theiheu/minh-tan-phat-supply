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
  subZones,
  customers,
  variants,
  triggerLabel = "Tạo phiếu xuất",
}: {
  zones: { id: string; name: string }[];
  subZones: { id: string; name: string; zone_id: string }[];
  customers: { id: string; name: string; phone?: string | null; address?: string | null }[];
  variants?: { id: string; name?: string; detail?: string; isTrackableLot?: boolean; price?: number | null; label?: string }[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[calc(100dvh-2rem)] sm:max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden border-2 border-border shadow-2xl rounded-2xl min-w-0">
        <DialogHeader className="shrink-0 pb-2 border-b pr-10 sm:pr-8 min-w-0">
          <DialogTitle className="text-base font-semibold">Tạo phiếu xuất kho mới</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Lập phiếu xuất cho khu vực trang trại hoặc bán cho khách hàng bên ngoài.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-2 pr-1">
          <IssueForm
            zones={zones}
            subZones={subZones}
            customers={customers}
            skus={variants}
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