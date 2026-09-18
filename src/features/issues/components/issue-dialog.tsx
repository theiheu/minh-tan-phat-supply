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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo phiếu xuất kho mới</DialogTitle>
          <DialogDescription>
            Lập phiếu xuất cho khu vực chuồng trại hoặc bán cho khách hàng bên ngoài.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}