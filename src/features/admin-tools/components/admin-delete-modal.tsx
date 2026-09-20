"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
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
import { adminDeleteDocAction, adminInspectDocAction } from "../actions";
import type { AdminDocKind, DocumentInspectResult } from "../types";

interface AdminDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AdminDocKind;
  id: string;
  code: string;
  docName: string;
  canReopen?: boolean;
  onSuccess?: () => void;
}

export function AdminDeleteModal({
  open,
  onOpenChange,
  kind,
  id,
  code,
  docName,
  canReopen = false,
  onSuccess,
}: AdminDeleteModalProps) {
  const [inspectData, setInspectData] = useState<DocumentInspectResult | null>(null);
  const [loadingInspect, setLoadingInspect] = useState(false);
  const [reason, setReason] = useState("");
  const [cascade, setCascade] = useState(true);
  const [confirmCodeInput, setConfirmCodeInput] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open && id) {
      setLoadingInspect(true);
      setReason("");
      setConfirmCodeInput("");
      adminInspectDocAction(kind, id)
        .then((res) => setInspectData(res))
        .catch(() => setInspectData(null))
        .finally(() => setLoadingInspect(false));
    }
  }, [open, kind, id]);

  const hasDependencies = (inspectData?.dependencies.length ?? 0) > 0;
  const isCodeMatch = confirmCodeInput.trim().toUpperCase() === code.trim().toUpperCase();

  const handleDelete = () => {
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do xoá phiếu");
      return;
    }
    if (!isCodeMatch) {
      toast.error(`Vui lòng nhập chính xác mã phiếu "${code}" để xác nhận`);
      return;
    }

    startTransition(async () => {
      try {
        await adminDeleteDocAction({
          kind,
          id,
          cascade,
          reason: reason.trim(),
        });
        toast.success(`Đã xoá vĩnh viễn ${docName} ${code} khỏi database`);
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Xoá phiếu thất bại");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            Xoá vĩnh viễn {docName} {code}
          </DialogTitle>
          <DialogDescription>
            Hành động này sẽ xoá hoàn toàn bản ghi khỏi database, tự động hoàn nguyên số dư tồn kho / công nợ và không thể khôi phục trực tiếp.
          </DialogDescription>
        </DialogHeader>

        {loadingInspect ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Đang kiểm tra quan hệ phụ thuộc của phiếu...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {hasDependencies && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  Cảnh báo: Có {inspectData?.dependencies.length} phiếu liên kết phụ thuộc
                </div>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                  {inspectData?.dependencies.map((dep, idx) => (
                    <li key={idx}>
                      <span className="font-semibold">{dep.kind.toUpperCase()}</span>: Mã {dep.code} (Trạng thái: {dep.status})
                    </li>
                  ))}
                </ul>

                <label className="mt-3 flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cascade}
                    onChange={(e) => setCascade(e.target.checked)}
                    className="size-4 rounded border-amber-400 text-destructive focus:ring-destructive"
                  />
                  Xoá dây chuyền (Cascade) toàn bộ các phiếu con liên quan
                </label>
              </div>
            )}

            {canReopen && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                💡 Lưu ý: Phiếu này đang ở trạng thái đã ghi sổ ({inspectData?.movements_count ?? "nhiều"} bút toán kho). Hệ thống sẽ tự động hoàn nguyên tồn kho về đúng giá trị ban đầu trước khi xoá.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="admin-delete-reason" className="text-xs font-medium">
                Lý do xoá phiếu <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="admin-delete-reason"
                placeholder="Ví dụ: Nhập nhầm phiếu xuất cho tổ 2, cần tạo lại..."
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-delete-code" className="text-xs font-medium">
                Nhập lại mã phiếu <span className="font-mono font-bold text-foreground">&quot;{code}&quot;</span> để mở khoá:
              </Label>
              <Input
                id="admin-delete-code"
                placeholder={code}
                value={confirmCodeInput}
                onChange={(e) => setConfirmCodeInput(e.target.value)}
                className="font-mono font-semibold"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending || !isCodeMatch || !reason.trim() || loadingInspect}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Đang xoá...
              </>
            ) : (
              "Xác nhận xoá vĩnh viễn"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
