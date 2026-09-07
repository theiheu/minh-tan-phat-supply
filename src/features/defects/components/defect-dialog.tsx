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
import { DefectForm } from "./defect-form";

export function DefectDialog({
  sourceLocationId,
  isManager = false,
  variants,
  triggerLabel = "Ghi nhận hỏng",
  triggerClassName,
}: {
  sourceLocationId: string;
  isManager?: boolean;
  variants: { id: string; name: string; detail: string }[];
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
      <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border-2 border-border shadow-2xl rounded-2xl">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="text-base font-semibold">Báo hỏng vật tư</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ghi nhận thông tin vật tư hư hỏng, gửi đi sửa chữa hoặc yêu cầu đổi mới.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2">
          <DefectForm
            sourceLocationId={sourceLocationId}
            isManager={isManager}
            variants={variants}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
