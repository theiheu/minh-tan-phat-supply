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
import type { Zone } from "@/lib/types";
import { RequisitionForm } from "./requisition-form";

export function RequisitionDialog({
  zones,
  defaultZoneId = null,
  currentUser = null,
  accounts = [],
  triggerLabel = "Tạo phiếu yêu cầu",
  triggerClassName,
}: {
  zones: Zone[];
  defaultZoneId?: string | null;
  currentUser?: { id: string; role: string; name: string | null } | null;
  accounts?: { id: string; name: string | null; username: string; zone_id: string | null }[];
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
      <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl h-[92svh] max-h-[92svh] sm:h-auto sm:max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden border-2 border-border shadow-2xl rounded-2xl">
        <DialogHeader className="shrink-0 pb-2 border-b">
          <DialogTitle className="text-base font-semibold">Tạo phiếu yêu cầu</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Lập phiếu yêu cầu cấp phát vật tư cho khu vực hoạt động.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-2 pr-1">
          <RequisitionForm
            zones={zones}
            defaultZoneId={defaultZoneId}
            currentUser={currentUser}
            accounts={accounts}
            onSuccess={(id) => {
              setOpen(false);
              router.push(`/requisitions/${id}`);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
