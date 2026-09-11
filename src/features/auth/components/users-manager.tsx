"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createUser } from "@/features/auth/actions/create-user";
import { resetPassword } from "@/features/auth/actions/reset-password";
import { updateUsername } from "@/features/auth/actions/update-username";
import { updateProfile } from "@/features/auth/actions/update-profile";
import {
  sendTestEmailAction,
  broadcastNotificationAction,
  batchAssignEmailsAction,
} from "@/features/auth/actions/admin-notifications";
import { isSuperuser } from "@/lib/types";
import { roleLabel } from "@/lib/labels";
import type { Profile } from "@/lib/types";

type ZoneOption = { id: string; name: string };
type SubZoneOption = { id: string; zone_id: string; name: string };

// Chỉ superuser mới được tạo/gán vai trò superuser (server cũng chặn).
function roleOptionsFor(currentRole: string): { value: string; label: string }[] {
  const base = [
    { value: "requester", label: "Người yêu cầu" },
    { value: "manager", label: "Quản lý kho" },
  ];
  if (isSuperuser(currentRole)) return [...base, { value: "superuser", label: "Quản trị hệ thống" }];
  return base;
}

function CreateAccountForm({
  zones,
  subZones = [],
  currentRole,
}: {
  zones: ZoneOption[];
  subZones?: SubZoneOption[];
  currentRole: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("requester");
  const roleOptions = roleOptionsFor(currentRole);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [subZoneId, setSubZoneId] = useState<string | null>(null);

  const availableSubZones = zoneId ? subZones.filter((s) => s.zone_id === zoneId) : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createUser({
          name,
          username,
          email: email.trim() || null,
          role,
          zoneId,
          subZoneId: zoneId ? subZoneId : null,
          password,
        });
        toast.success(`Đã tạo tài khoản ${username.trim().toLowerCase()}`);
        setName("");
        setUsername("");
        setEmail("");
        setPassword("");
        setRole("requester");
        setZoneId(null);
        setSubZoneId(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo tài khoản thất bại");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tạo tài khoản mới</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-name">Tên</Label>
            <Input id="cu-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-username">Tên đăng nhập</Label>
            <Input
              id="cu-username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-z][a-z0-9._-]{2,29}"
              title="Chữ thường không dấu, số, . _ - ; bắt đầu bằng chữ cái"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="nguyen.van.a"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-email">Email (nhận thông báo)</Label>
            <Input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@vidu.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cu-password">Mật khẩu</Label>
            <Input
              id="cu-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Vai trò</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Khu vực</Label>
            <Select
              value={zoneId ?? "none"}
              onValueChange={(v) => {
                setZoneId(v === "none" ? null : v);
                setSubZoneId(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Không —</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Trại / Xưởng</Label>
            <Select
              value={subZoneId ?? "none"}
              onValueChange={(v) => setSubZoneId(v === "none" ? null : v)}
              disabled={!zoneId || availableSubZones.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="— Không —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Không —</SelectItem>
                {availableSubZones.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Đang tạo…" : "Tạo tài khoản"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function UserRow({
  profile,
  zones,
  subZones = [],
  currentRole,
}: {
  profile: Profile;
  zones: ZoneOption[];
  subZones?: SubZoneOption[];
  currentRole: string;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [role, setRole] = useState(profile.role);
  const [zoneId, setZoneId] = useState<string | null>(profile.zone_id);
  const [subZoneId, setSubZoneId] = useState<string | null>(profile.sub_zone_id);
  const [isActive, setIsActive] = useState(profile.is_active);
  const [resettingPw, setResettingPw] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const roleOptions = roleOptionsFor(currentRole);
  const isSystemAccount = profile.is_protected;
  const canEdit = !isSystemAccount; // server vẫn chặn; UI khóa luôn cho rõ

  const availableSubZones = zoneId ? subZones.filter((s) => s.zone_id === zoneId) : [];

  function save() {
    startTransition(async () => {
      try {
        const un = username.trim().toLowerCase();
        if (un !== profile.username) {
          await updateUsername({ userId: profile.id, username: un });
        }
        await updateProfile({
          userId: profile.id,
          name,
          email: email.trim() || null,
          role,
          zoneId,
          subZoneId: zoneId ? subZoneId : null,
          isActive,
        });
        toast.success("Đã cập nhật người dùng");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
      }
    });
  }

  function savePassword() {
    startTransition(async () => {
      try {
        await resetPassword({ userId: profile.id, password: newPassword });
        toast.success("Đã đặt lại mật khẩu");
        setNewPassword("");
        setResettingPw(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Đặt lại mật khẩu thất bại");
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="min-w-[150px]">
        <div className="flex items-center gap-1.5">
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
          {isSystemAccount && (
            <Badge variant="violet" className="shrink-0">Hệ thống</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="min-w-[130px]">
        <Input
          value={username}
          minLength={3}
          maxLength={30}
          pattern="[a-z][a-z0-9._-]{2,29}"
          onChange={(e) => setUsername(e.target.value)}
          disabled={!canEdit}
        />
      </TableCell>
      <TableCell className="min-w-[160px]">
        <Input
          type="email"
          value={email}
          placeholder="email@vidu.com"
          onChange={(e) => setEmail(e.target.value)}
          disabled={!canEdit}
        />
      </TableCell>
      <TableCell>
        {!canEdit ? (
          <span className="text-sm font-medium">{roleLabel(profile.role)}</span>
        ) : (
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full min-w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <Select
            value={zoneId ?? "none"}
            onValueChange={(v) => {
              setZoneId(v === "none" ? null : v);
              setSubZoneId(null);
            }}
            disabled={!canEdit}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Không —</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {zoneId && availableSubZones.length > 0 && (
            <Select
              value={subZoneId ?? "none"}
              onValueChange={(v) => setSubZoneId(v === "none" ? null : v)}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-full text-xs h-8">
                <SelectValue placeholder="— Trại/Xưởng —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Không chọn —</SelectItem>
                {availableSubZones.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </TableCell>
      <TableCell>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={!canEdit}
            className="size-4 accent-primary"
          />
          {isActive ? (
            <Badge variant="success">Hoạt động</Badge>
          ) : (
            <Badge variant="neutral">Đã khóa</Badge>
          )}
        </label>
      </TableCell>
      <TableCell className="min-w-[160px]">
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-1.5">
            {canEdit ? (
              <Button variant="outline" size="sm" onClick={save} disabled={pending}>
                {pending ? "…" : "Lưu"}
              </Button>
            ) : null}
            {(!isSystemAccount || isSuperuser(currentRole)) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResettingPw((v) => !v);
                  setNewPassword("");
                }}
              >
                Đổi mật khẩu
              </Button>
            )}
          </div>
          {resettingPw && (
            <div className="flex gap-1.5">
              <Input
                type="password"
                minLength={8}
                placeholder="Mật khẩu mới (≥8)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-8 w-40"
              />
              <Button size="sm" onClick={savePassword} disabled={pending || newPassword.length < 8}>
                Lưu
              </Button>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmailToolsCard() {
  const router = useRouter();
  const [testEmail, setTestEmail] = useState("");
  const [testPending, startTestTransition] = useTransition();

  const [domain, setDomain] = useState("");
  const [assignPending, startAssignTransition] = useTransition();

  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastPending, startBroadcastTransition] = useTransition();

  function onSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail.trim()) return;
    startTestTransition(async () => {
      try {
        await sendTestEmailAction(testEmail.trim());
        toast.success(`Đã gửi email kiểm tra tới ${testEmail}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gửi email thất bại");
      }
    });
  }

  function onBatchAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    startAssignTransition(async () => {
      try {
        const res = await batchAssignEmailsAction({ domain: domain.trim() });
        toast.success(`Đã gán email @${domain.trim()} cho ${res.updatedCount} tài khoản.`);
        setDomain("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gán email thất bại");
      }
    });
  }

  function onBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!broadcastTitle.trim()) return;
    startBroadcastTransition(async () => {
      try {
        const res = await broadcastNotificationAction({
          title: broadcastTitle.trim(),
          body: broadcastBody.trim() || undefined,
          sendEmail: true,
        });
        toast.success(`Đã gửi thông báo in-app và email tới ${res.count} người dùng.`);
        setBroadcastTitle("");
        setBroadcastBody("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gửi thông báo thất bại");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Công cụ Email Doanh Nghiệp & Thông báo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Cột 1: Test SMTP */}
          <form onSubmit={onSendTest} className="space-y-3 rounded-lg border p-4 bg-muted/20 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="font-semibold text-sm">1. Thử nghiệm kết nối SMTP</div>
              <p className="text-xs text-muted-foreground">
                Gửi 1 email kiểm tra để xác nhận cấu hình máy chủ gửi thư & tên miền doanh nghiệp.
              </p>
              <Input
                type="email"
                required
                placeholder="ten.ban@congty.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={testPending} className="w-full">
              {testPending ? "Đang gửi email test…" : "Gửi email kiểm tra"}
            </Button>
          </form>

          {/* Cột 2: Gán email hàng loạt */}
          <form onSubmit={onBatchAssign} className="space-y-3 rounded-lg border p-4 bg-muted/20 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="font-semibold text-sm">2. Gán email theo tên miền</div>
              <p className="text-xs text-muted-foreground">
                Tự động gán email <code className="text-xs font-mono">username@domain</code> cho các user chưa có email.
              </p>
              <Input
                type="text"
                required
                placeholder="minhtanphat.vn"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={assignPending} className="w-full">
              {assignPending ? "Đang xử lý…" : "Gán email tự động"}
            </Button>
          </form>

          {/* Cột 3: Phát thông báo */}
          <form onSubmit={onBroadcast} className="space-y-3 rounded-lg border p-4 bg-muted/20 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="font-semibold text-sm">3. Phát thông báo hệ thống</div>
              <p className="text-xs text-muted-foreground">
                Gửi thông báo chuông in-app và email đồng thời tới toàn bộ người dùng đang hoạt động.
              </p>
              <Input
                required
                placeholder="Tiêu đề thông báo..."
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
              />
              <Input
                placeholder="Nội dung chi tiết (tùy chọn)..."
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" disabled={broadcastPending} className="w-full">
              {broadcastPending ? "Đang phát thông báo…" : "Phát thông báo cho tất cả"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

export function UsersManager({
  profiles,
  zones,
  subZones = [],
  currentRole,
  page = 1,
  totalPages = 1,
}: {
  profiles: Profile[];
  zones: ZoneOption[];
  subZones?: SubZoneOption[];
  currentRole: string;
  /** Trang hiện tại (searchParams.page) — mặc định 1. */
  page?: number;
  /** Tổng số trang — mặc định 1 (ẩn phân trang). */
  totalPages?: number;
}) {
  return (
    <div className="space-y-4">
      <EmailToolsCard />
      <CreateAccountForm zones={zones} subZones={subZones} currentRole={currentRole} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách người dùng</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Tên đăng nhập</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Khu vực / Trại</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <UserRow key={p.id} profile={p} zones={zones} subZones={subZones} currentRole={currentRole} />
              ))}
            </TableBody>
          </Table>
          <Pagination basePath="/admin/users" page={page} totalPages={totalPages} className="mt-4" />
        </CardContent>
      </Card>
    </div>
  );
}
