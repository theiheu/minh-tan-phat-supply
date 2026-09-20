"use client";

import { useState, useTransition } from "react";
import { Edit3, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminOverrideMetaAction } from "../actions";
import type { AdminDocKind } from "../types";

interface AdminEditMetaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AdminDocKind;
  id: string;
  code: string;
  docName: string;
  initialCreatedAt?: string;
  initialNotes?: string | null;
  onSuccess?: () => void;
}

export function AdminEditMetaModal({
  open,
  onOpenChange,
  kind,
  id,
  code,
  docName,
  initialCreatedAt,
  initialNotes,
  onSuccess,
}: AdminEditMetaModalProps) {
  const [createdAt, setCreatedAt] = useState(
    initialCreatedAt ? new Date(initialCreatedAt).toISOString().slice(0, 16) : ""
  );
  const [notes, setNotes] = useState(initialNotes || "");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do can thiệp thông tin phiếu");
      return;
    }

    startTransition(async () => {
      try {
        await adminOverrideMetaAction({
          kind,
          id,
          createdAt: createdAt ? new Date(createdAt).toISOString() : null,
          notes: notes.trim() || null,
          reason: reason.trim(),
        });
        toast.success(`Đã cập nhật thông tin ${docName} ${code}`);
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Cập nhật thất bại");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="size-5 text-primary" />
            Can thiệp thông tin {docName} {code}
          </DialogTitle>
          <DialogDescription>
            Quyền Admin: Cho phép sửa trực tiếp ngày lập phiếu và ghi chú của bất kỳ phiếu nào trong hệ thống.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="admin-meta-created-at" className="text-xs font-medium">
              Ngày lập phiếu (Created At)
            </Label>
            <Input
              id="admin-meta-created-at"
              type="datetime-local"
              value={createdAt}
              onChange={(e) => setCreatedAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-meta-notes" className="text-xs font-medium">
              Ghi chú phiếu
            </Label>
            <Textarea
              id="admin-meta-notes"
              placeholder="Ghi chú nội dung phiếu..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-meta-reason" className="text-xs font-medium">
              Lý do can thiệp <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="admin-meta-reason"
              placeholder="Ví dụ: Điều chỉnh ngày lập theo chứng từ giấy gốc..."
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={pending || !reason.trim()}>
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              "Lưu thay đổi"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
