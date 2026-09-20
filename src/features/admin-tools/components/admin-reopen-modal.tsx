"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminReopenDocAction } from "../actions";
import type { AdminDocKind } from "../types";

interface AdminReopenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AdminDocKind;
  id: string;
  code: string;
  docName: string;
  onSuccess?: () => void;
}

export function AdminReopenModal({
  open,
  onOpenChange,
  kind,
  id,
  code,
  docName,
  onSuccess,
}: AdminReopenModalProps) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const handleReopen = () => {
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do mở lại phiếu");
      return;
    }

    startTransition(async () => {
      try {
        await adminReopenDocAction({
          kind,
          id,
          reason: reason.trim(),
        });
        toast.success(`Đã mở lại ${docName} ${code} về trạng thái sửa được`);
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Mở lại phiếu thất bại");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-5 text-primary" />
            Mở lại {docName} {code}
          </DialogTitle>
          <DialogDescription>
            Phiếu sẽ được chuyển về trạng thái Chưa chốt (Nháp / Chờ duyệt) để chỉnh sửa. Toàn bộ bút toán kho đã ghi sổ sẽ được tạm thời đảo ngược.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="admin-reopen-reason" className="text-xs font-medium">
              Lý do mở lại <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="admin-reopen-reason"
              placeholder="Ví dụ: Cần điều chỉnh lại số lượng thực tế..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Hủy
          </Button>
          <Button onClick={handleReopen} disabled={pending || !reason.trim()}>
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Đang mở lại...
              </>
            ) : (
              "Xác nhận mở lại"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
