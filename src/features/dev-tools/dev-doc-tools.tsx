"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { devDeleteDoc, devReopenDoc, type DevDocKind } from "@/features/dev-tools/actions";

/**
 * Nút công cụ DEV (chỉ render khi isDev): "Mở lại sửa" (đảo bút toán về trạng thái
 * sửa được) và "Xoá phiếu" (đã ghi sổ sẽ đảo bút toán trước khi xoá).
 * RPC phía DB tự kiểm superuser — UI ẩn chỉ là lớp trình bày.
 */
export function DevDocTools({
  kind,
  id,
  code,
  docName,
  canReopen,
  isDev,
  compact = false,
}: {
  kind: DevDocKind;
  id: string;
  code: string;
  /** Tên loại phiếu dùng trong câu xác nhận (VD "phiếu xuất"). */
  docName: string;
  /** Phiếu có ở trạng thái "đã ghi sổ" → cho phép Mở lại sửa. */
  canReopen: boolean;
  isDev: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!isDev) return null;

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  const reopen = () => {
    if (!window.confirm(`Mở lại ${docName} ${code} về trạng thái sửa được?\n\nToàn bộ bút toán tồn kho sẽ bị đảo ngược. Sau khi sửa phải chốt lại để ghi sổ.`)) return;
    run(() => devReopenDoc(kind, id), `Đã mở lại ${docName} ${code}`);
  };
  const remove = () => {
    if (!window.confirm(`Xoá ${docName} ${code}?\n\n${canReopen ? "Phiếu đã ghi sổ: bút toán tồn kho sẽ bị đảo ngược trước khi xoá. " : ""}Hành động không thể hoàn tác.`)) return;
    run(() => devDeleteDoc(kind, id), `Đã xoá ${docName}`);
  };

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {canReopen && (
        <Button variant="outline" size={compact ? "sm" : "default"} disabled={pending} onClick={reopen} title="Dev: đảo bút toán, mở lại để sửa số liệu">
          <Pencil className="size-3.5" aria-hidden />
          {compact ? "Mở lại" : "Mở lại sửa"}
        </Button>
      )}
      <Button variant="ghost" size={compact ? "sm" : "default"} className="text-destructive hover:text-destructive" disabled={pending} onClick={remove} title="Dev: xoá phiếu">
        <Trash2 className="size-3.5" aria-hidden />
        Xoá
      </Button>
    </span>
  );
}
