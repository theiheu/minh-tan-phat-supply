"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminDeleteModal } from "./admin-delete-modal";
import { AdminEditMetaModal } from "./admin-edit-meta-modal";
import { AdminReopenModal } from "./admin-reopen-modal";
import type { AdminDocKind } from "../types";

export interface AdminDocToolsProps {
  kind: AdminDocKind;
  id: string;
  code: string;
  /** Tên loại phiếu dùng trong câu xác nhận (VD: "phiếu xuất", "phiếu nhập"). */
  docName: string;
  /** Phiếu có ở trạng thái "đã ghi sổ" → cho phép Mở lại sửa. */
  canReopen: boolean;
  /** true nếu người dùng có quyền Quản trị viên (superuser / owner). */
  isAdmin?: boolean;
  /** Tương thích ngược với tên prop isDev. */
  isDev?: boolean;
  compact?: boolean;
  allowMetaEdit?: boolean;
  initialCreatedAt?: string;
  initialNotes?: string | null;
  onDeleted?: () => void;
  onReopened?: () => void;
}

export function AdminDocTools({
  kind,
  id,
  code,
  docName,
  canReopen,
  isAdmin,
  isDev,
  compact = false,
  allowMetaEdit = true,
  initialCreatedAt,
  initialNotes,
  onDeleted,
  onReopened,
}: AdminDocToolsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [editMetaOpen, setEditMetaOpen] = useState(false);

  // Cho phép hiển thị nếu isAdmin hoặc isDev là true
  const hasAdminAccess = isAdmin ?? isDev ?? false;
  if (!hasAdminAccess) return null;

  const handleDeletedSuccess = () => {
    if (onDeleted) {
      onDeleted();
    } else {
      router.refresh();
    }
  };

  const handleReopenSuccess = () => {
    if (onReopened) {
      onReopened();
    } else {
      router.refresh();
    }
  };

  const handleMetaSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <span className="flex flex-wrap items-center gap-1.5">
        {canReopen && (
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={() => setReopenOpen(true)}
            title="Quản trị: Đảo bút toán, mở lại để sửa số liệu"
            className="border-amber-300 text-amber-900 hover:bg-amber-100/50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/50"
          >
            <Pencil className="size-3.5 mr-1" aria-hidden />
            {compact ? "Mở lại" : "Mở lại sửa"}
          </Button>
        )}

        {allowMetaEdit && (
          <Button
            variant="ghost"
            size={compact ? "sm" : "default"}
            onClick={() => setEditMetaOpen(true)}
            title="Quản trị: Can thiệp ngày lập / ghi chú"
            className="text-muted-foreground hover:text-foreground"
          >
            <Edit3 className="size-3.5 mr-1" aria-hidden />
            {compact ? "Sửa" : "Can thiệp"}
          </Button>
        )}

        <Button
          variant="ghost"
          size={compact ? "sm" : "default"}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
          title="Quản trị: Xoá vĩnh viễn phiếu khỏi database"
        >
          <Trash2 className="size-3.5 mr-1" aria-hidden />
          Xoá
        </Button>
      </span>

      {deleteOpen && (
        <AdminDeleteModal
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          kind={kind}
          id={id}
          code={code}
          docName={docName}
          canReopen={canReopen}
          onSuccess={handleDeletedSuccess}
        />
      )}

      {reopenOpen && (
        <AdminReopenModal
          open={reopenOpen}
          onOpenChange={setReopenOpen}
          kind={kind}
          id={id}
          code={code}
          docName={docName}
          onSuccess={handleReopenSuccess}
        />
      )}

      {editMetaOpen && (
        <AdminEditMetaModal
          open={editMetaOpen}
          onOpenChange={setEditMetaOpen}
          kind={kind}
          id={id}
          code={code}
          docName={docName}
          initialCreatedAt={initialCreatedAt}
          initialNotes={initialNotes}
          onSuccess={handleMetaSuccess}
        />
      )}
    </>
  );
}
