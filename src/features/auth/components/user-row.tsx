"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Archive,
  KeyRound,
  Loader2,
  Lock,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { resetPassword } from "@/features/auth/actions/reset-password";
import { updateProfile } from "@/features/auth/actions/update-profile";
import {
  archiveUser,
  checkUserDeleteEligibility,
  deleteUser,
  reactivateUser,
} from "@/features/auth/actions/delete-user";
import { canDeleteUsers, isSuperuser } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { roleOptionsFor } from "@/features/auth/utils/roles";
import type { ZoneOption } from "@/features/auth/utils/roles";

export function UserRow({
  profile,
  zones,
  currentRole,
  currentUserId,
}: {
  profile: Profile;
  zones: ZoneOption[];
  currentRole: string;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState(profile.email ?? "");
  const [role, setRole] = useState(profile.role);
  const [zoneId, setZoneId] = useState<string | null>(profile.zone_id);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Trạng thái modal Xóa / Lưu trữ thông minh
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    checking: boolean;
    canHardDelete: boolean;
    historyReason: string | null;
    isCallerSuperuser: boolean;
  }>({
    open: false,
    checking: false,
    canHardDelete: false,
    historyReason: null,
    isCallerSuperuser: isSuperuser(currentRole),
  });

  const roleOptions = roleOptionsFor(currentRole, profile.role);
  const isSystemAccount = profile.is_protected;
  const canEdit = !isSystemAccount && profile.is_active;
  const canDeleteOrArchive = canDeleteUsers(currentRole) && !isSystemAccount && profile.id !== currentUserId;

  const isModified =
    email !== (profile.email ?? "") ||
    role !== profile.role ||
    zoneId !== profile.zone_id;

  function save() {
    startTransition(async () => {
      try {
        await updateProfile({
          userId: profile.id,
          name: profile.name,
          email: email.trim() || null,
          role,
          zoneId,
          subZoneId: null,
          isActive: profile.is_active,
        });
        toast.success("Đã cập nhật thông tin người dùng");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
      }
    });
  }

  function savePassword() {
    startTransition(async () => {
      try {
        await resetPassword({ userId: profile.id, password: newPassword });
        toast.success(`Đã đặt lại mật khẩu cho ${profile.name}`);
        setNewPassword("");
        setResetPwOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Đặt lại mật khẩu thất bại");
      }
    });
  }

  async function openSmartDeleteModal() {
    setActionModal({
      open: true,
      checking: true,
      canHardDelete: false,
      historyReason: null,
      isCallerSuperuser: isSuperuser(currentRole),
    });
    try {
      const res = await checkUserDeleteEligibility({ userId: profile.id });
      setActionModal({
        open: true,
        checking: false,
        canHardDelete: res.canHardDelete,
        historyReason: res.historyReason,
        isCallerSuperuser: res.isCallerSuperuser,
      });
    } catch {
      setActionModal((prev) => ({ ...prev, checking: false }));
    }
  }

  function handleHardDelete() {
    startTransition(async () => {
      try {
        await deleteUser({ userId: profile.id });
        toast.success(`Đã xóa vĩnh viễn tài khoản ${profile.username || profile.name}`);
        setActionModal((prev) => ({ ...prev, open: false }));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa tài khoản thất bại");
      }
    });
  }

  function handleForceDelete() {
    startTransition(async () => {
      try {
        await deleteUser({ userId: profile.id, force: true });
        toast.success(`Đã xóa sạch tài khoản ${profile.name} (${profile.username}) cùng toàn bộ dữ liệu lịch sử`);
        setActionModal((prev) => ({ ...prev, open: false }));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xóa sạch tài khoản thất bại");
      }
    });
  }

  function handleArchive() {
    startTransition(async () => {
      try {
        await archiveUser({ userId: profile.id });
        toast.success(`Đã khóa tài khoản ${profile.name} (chuyển vào danh sách Đã nghỉ việc / Lưu trữ)`);
        setActionModal((prev) => ({ ...prev, open: false }));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Khóa tài khoản thất bại");
      }
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      try {
        await reactivateUser({ userId: profile.id });
        toast.success(`Đã mở khóa / kích hoạt lại tài khoản cho ${profile.name}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Kích hoạt lại thất bại");
      }
    });
  }

  function handleToggleActive(checked: boolean) {
    if (checked) {
      handleReactivate();
    } else {
      openSmartDeleteModal();
    }
  }

  return (
    <TableRow className={!profile.is_active ? "bg-muted/30 opacity-80" : ""}>
      {/* 1. Họ và tên: CỐ ĐỊNH, không sửa */}
      <TableCell className="align-middle font-medium">
        <div className="flex flex-col">
          <span className={!profile.is_active ? "line-through text-muted-foreground" : "text-foreground font-semibold"}>
            {profile.name}
          </span>
          {isSystemAccount && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-normal">
              (Tài khoản hệ thống)
            </span>
          )}
        </div>
      </TableCell>

      {/* 2. Tên đăng nhập: CỐ ĐỊNH, không sửa (bỏ @) */}
      <TableCell className="align-middle">
        <code className="text-xs bg-muted/80 text-foreground px-2 py-1 rounded font-mono font-medium border">
          {profile.username}
        </code>
      </TableCell>

      {/* 3. Email nhận thông báo: Cho phép sửa */}
      <TableCell className="align-middle">
        {profile.is_active ? (
          <Input
            type="email"
            placeholder="— Chưa có email —"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canEdit}
            className="h-9 w-full min-w-[160px] text-xs"
          />
        ) : (
          <span className="text-xs text-muted-foreground">{profile.email || "—"}</span>
        )}
      </TableCell>

      {/* 4. Vai trò */}
      <TableCell className="align-middle">
        {profile.is_active ? (
          isSystemAccount ? (
            <Badge variant="neutral">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
          ) : (
            <Select value={role} onValueChange={setRole} disabled={!canEdit}>
              <SelectTrigger className="w-full min-w-[150px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        ) : (
          <Badge variant="neutral">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
        )}
      </TableCell>

      {/* 5. Khu vực */}
      <TableCell className="align-middle">
        {profile.is_active ? (
          <Select
            value={zoneId ?? "none"}
            onValueChange={(v) => setZoneId(v === "none" ? null : v)}
            disabled={!canEdit}
          >
            <SelectTrigger className="w-full min-w-[130px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Không —</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">
            {zones.find((z) => z.id === profile.zone_id)?.name ?? "— Không —"}
          </span>
        )}
      </TableCell>

      {/* 6. Trạng thái & Thao tác Khóa/Mở khóa trực tiếp */}
      <TableCell className="align-middle">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={profile.is_active}
            onChange={(e) => handleToggleActive(e.target.checked)}
            disabled={pending || isSystemAccount || profile.id === currentUserId || !canDeleteUsers(currentRole)}
            className="size-4 accent-primary rounded cursor-pointer disabled:cursor-not-allowed"
            title={profile.is_active ? "Bấm để khóa tài khoản" : "Bấm để mở khóa tài khoản"}
          />
          {profile.is_active ? (
            <Badge variant="success">Đang làm việc</Badge>
          ) : (
            <Badge variant="neutral">Đã khóa</Badge>
          )}
        </label>
      </TableCell>

      {/* 7. Thao tác */}
      <TableCell className="align-middle min-w-[190px]">
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5 h-9">
            {profile.is_active ? (
              <>
                {isModified && (
                  <Button variant="default" size="sm" onClick={save} disabled={pending} className="h-8 text-xs">
                    {pending ? "…" : "Lưu"}
                  </Button>
                )}
                {(!isSystemAccount || isSuperuser(currentRole)) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setNewPassword("");
                      setResetPwOpen(true);
                    }}
                  >
                    Đổi MK
                  </Button>
                )}
                {canDeleteOrArchive && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 h-8 px-2"
                      title="Khóa tài khoản / Đánh dấu nghỉ việc"
                      onClick={openSmartDeleteModal}
                      disabled={pending}
                    >
                      <Lock className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                      title="Xóa vĩnh viễn (nếu chưa có phiếu)"
                      onClick={openSmartDeleteModal}
                      disabled={pending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
                {canDeleteUsers(currentRole) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                    onClick={handleReactivate}
                    disabled={pending}
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Kích hoạt lại</span>
                  </Button>
                )}
                {canDeleteOrArchive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                    title="Xóa vĩnh viễn tài khoản (nếu chưa có phiếu)"
                    onClick={openSmartDeleteModal}
                    disabled={pending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </>
            )}
          </div>

        </div>

        {/* Modal Đổi mật khẩu chuyên dụng (tránh trùng nút Lưu trên cùng 1 hàng) */}
        {resetPwOpen && (
          <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="size-5 text-primary" />
                  Đổi mật khẩu người dùng
                </DialogTitle>
                <DialogDescription>
                  Đặt lại mật khẩu mới cho tài khoản <strong>{profile.name}</strong> (<code>{profile.username}</code>).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`new-pw-${profile.id}`}>Mật khẩu mới (tối thiểu 8 ký tự) *</Label>
                  <Input
                    id={`new-pw-${profile.id}`}
                    type="password"
                    minLength={8}
                    required
                    placeholder="Nhập mật khẩu mới..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setResetPwOpen(false);
                    setNewPassword("");
                  }}
                  disabled={pending}
                >
                  Hủy
                </Button>
                <Button
                  onClick={savePassword}
                  disabled={pending || newPassword.length < 8}
                >
                  {pending ? "Đang lưu…" : "Cập nhật mật khẩu"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Modal Thông Minh: Tự động phân loại Xóa Vĩnh Viễn vs Lưu Trữ theo lịch sử */}
        {actionModal.open && (
          <Dialog open={actionModal.open} onOpenChange={(open) => setActionModal((prev) => ({ ...prev, open }))}>
            <DialogContent className="sm:max-w-md">
              {actionModal.checking ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p>Đang kiểm tra lịch sử chứng từ của tài khoản…</p>
                </div>
              ) : actionModal.canHardDelete ? (
                // NHÁNH 1: Chưa có phiếu -> XÓA VĨNH VIỄN
                <>
                  <DialogHeader>
                    <DialogTitle className="text-destructive flex items-center gap-2">
                      <Trash2 className="size-5" />
                      Xác nhận xóa vĩnh viễn tài khoản
                    </DialogTitle>
                    <DialogDescription className="space-y-2 pt-2">
                      <p>
                        Tài khoản <strong>{profile.name} (@{profile.username})</strong> chưa từng phát sinh chứng từ nào.
                      </p>
                      <p className="text-destructive font-medium">
                        Hành động này sẽ xóa sạch tài khoản khỏi hệ thống và giải phóng tên đăng nhập.
                      </p>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setActionModal((prev) => ({ ...prev, open: false }))}
                      disabled={pending}
                    >
                      Hủy
                    </Button>
                    <Button variant="destructive" onClick={handleHardDelete} disabled={pending}>
                      {pending ? "Đang xóa…" : "Xóa vĩnh viễn"}
                    </Button>
                  </DialogFooter>
                </>
              ) : actionModal.isCallerSuperuser ? (
                // NHÁNH 2A: Quản trị hệ thống (Superuser) -> Tùy chọn Lưu trữ HOẶC Xóa Sạch Toàn Bộ Lịch Sử
                <>
                  <DialogHeader>
                    <DialogTitle className="text-destructive flex items-center gap-2">
                      <Trash2 className="size-5" />
                      Tùy chọn xử lý tài khoản (Quản trị hệ thống)
                    </DialogTitle>
                    <DialogDescription className="space-y-2.5 pt-2">
                      <p>
                        Tài khoản <strong>{profile.name} ({profile.username})</strong> đã có phát sinh dữ liệu lịch sử:
                      </p>
                      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs p-2.5 rounded-md font-medium leading-relaxed">
                        {actionModal.historyReason}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Với vai trò <strong>Quản trị hệ thống</strong>, bạn có thể chọn <strong>Lưu trữ (Khóa)</strong> để bảo toàn chứng từ hoặc <strong>Xóa sạch vĩnh viễn</strong> để quét sạch cả tài khoản và toàn bộ lịch sử phiếu/chứng từ liên quan khỏi hệ thống.
                      </p>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setActionModal((prev) => ({ ...prev, open: false }))}
                      disabled={pending}
                    >
                      Hủy
                    </Button>
                    <Button
                      variant="outline"
                      className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-800"
                      onClick={handleArchive}
                      disabled={pending}
                    >
                      Lưu trữ (Khóa)
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleForceDelete}
                      disabled={pending}
                    >
                      {pending ? "Đang xóa sạch…" : "Xóa sạch toàn bộ (Bao gồm phiếu)"}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                // NHÁNH 2B: Kế toán / Chủ trại -> LƯU TRỮ & ĐÁNH DẤU NGHỈ VIỆC
                <>
                  <DialogHeader>
                    <DialogTitle className="text-amber-600 dark:text-amber-500 flex items-center gap-2">
                      <Archive className="size-5" />
                      Lưu trữ & Đánh dấu nghỉ việc
                    </DialogTitle>
                    <DialogDescription className="space-y-2.5 pt-2">
                      <p>
                        Tài khoản <strong>{profile.name} ({profile.username})</strong> đã phát sinh dữ liệu trong hệ thống:
                      </p>
                      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs p-2.5 rounded-md font-medium leading-relaxed">
                        {actionModal.historyReason}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Để bảo toàn chứng từ kế toán và sổ sách kho, tài khoản sẽ được <strong>khóa đăng nhập ngay lập tức</strong> và chuyển vào danh sách <strong>Đã nghỉ việc / Lưu trữ</strong>. Bạn có thể kích hoạt lại bất kỳ lúc nào.
                      </p>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setActionModal((prev) => ({ ...prev, open: false }))}
                      disabled={pending}
                    >
                      Hủy
                    </Button>
                    <Button
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleArchive}
                      disabled={pending}
                    >
                      {pending ? "Đang xử lý…" : "Xác nhận lưu trữ"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        )}
      </TableCell>
    </TableRow>
  );
}
