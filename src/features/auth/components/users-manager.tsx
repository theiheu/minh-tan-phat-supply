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
import { isSuperuser } from "@/lib/types";
import { roleLabel } from "@/lib/labels";
import type { Profile } from "@/lib/types";

type ZoneOption = { id: string; name: string };

// Chỉ superuser mới được tạo/gán vai trò superuser (server cũng chặn).
function roleOptionsFor(currentRole: string): { value: string; label: string }[] {
  const base = [
    { value: "requester", label: "Người yêu cầu" },
    { value: "manager", label: "Quản lý kho" },
  ];
  if (isSuperuser(currentRole)) return [...base, { value: "superuser", label: "Quản trị hệ thống" }];
  return base;
}

function CreateAccountForm({ zones, currentRole }: { zones: ZoneOption[]; currentRole: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("requester");
  const roleOptions = roleOptionsFor(currentRole);
  const [zoneId, setZoneId] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createUser({ name, username, role, zoneId, password });
        toast.success(`Đã tạo tài khoản ${username.trim().toLowerCase()}`);
        setName("");
        setUsername("");
        setPassword("");
        setRole("requester");
        setZoneId(null);
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
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="cu-name">Tên</Label>
            <Input id="cu-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label>Khu vực</Label>
            <Select value={zoneId ?? "none"} onValueChange={(v) => setZoneId(v === "none" ? null : v)}>
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

function UserRow({ profile, zones, currentRole }: { profile: Profile; zones: ZoneOption[]; currentRole: string }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [role, setRole] = useState(profile.role);
  const [zoneId, setZoneId] = useState<string | null>(profile.zone_id);
  const [isActive, setIsActive] = useState(profile.is_active);
  const [resettingPw, setResettingPw] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const roleOptions = roleOptionsFor(currentRole);
  const isSystemAccount = profile.is_protected;
  const canEdit = !isSystemAccount; // server vẫn chặn; UI khóa luôn cho rõ

  function save() {
    startTransition(async () => {
      try {
        const un = username.trim().toLowerCase();
        if (un !== profile.username) {
          await updateUsername({ userId: profile.id, username: un });
        }
        await updateProfile({ userId: profile.id, name, role, zoneId, isActive });
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
      <TableCell className="min-w-[160px]">
        <div className="flex items-center gap-1.5">
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
          {isSystemAccount && (
            <Badge variant="violet" className="shrink-0">Hệ thống</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="min-w-[140px]">
        <Input
          value={username}
          minLength={3}
          maxLength={30}
          pattern="[a-z][a-z0-9._-]{2,29}"
          onChange={(e) => setUsername(e.target.value)}
          disabled={!canEdit}
        />
      </TableCell>
      <TableCell>
        {!canEdit ? (
          <span className="text-sm font-medium">{roleLabel(profile.role)}</span>
        ) : (
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full min-w-[140px]">
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
        <Select value={zoneId ?? "none"} onValueChange={(v) => setZoneId(v === "none" ? null : v)} disabled={!canEdit}>
          <SelectTrigger className="w-full min-w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Không —</SelectItem>
            {zones.map((z) => (
              <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <TableCell className="min-w-[170px]">
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

export function UsersManager({
  profiles,
  zones,
  currentRole,
  page = 1,
  totalPages = 1,
}: {
  profiles: Profile[];
  zones: ZoneOption[];
  currentRole: string;
  /** Trang hiện tại (searchParams.page) — mặc định 1. */
  page?: number;
  /** Tổng số trang — mặc định 1 (ẩn phân trang). */
  totalPages?: number;
}) {
  return (
    <div className="space-y-4">
      <CreateAccountForm zones={zones} currentRole={currentRole} />
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
                <TableHead>Vai trò</TableHead>
                <TableHead>Khu vực</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <UserRow key={p.id} profile={p} zones={zones} currentRole={currentRole} />
              ))}
            </TableBody>
          </Table>
          <Pagination basePath="/admin/users" page={page} totalPages={totalPages} className="mt-4" />
        </CardContent>
      </Card>
    </div>
  );
}
