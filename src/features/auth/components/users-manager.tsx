"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { inviteUser } from "@/features/auth/actions/invite-user";
import { updateProfile } from "@/features/auth/actions/update-profile";
import type { Profile } from "@/lib/types";

type ProfileWithEmail = Profile & { email: string | null };
type ZoneOption = { id: string; name: string };

const ROLE_OPTIONS = [
  { value: "requester", label: "Người yêu cầu" },
  { value: "manager", label: "Quản lý kho" },
];

function InviteForm({ zones }: { zones: ZoneOption[] }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("requester");
  const [zoneId, setZoneId] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await inviteUser({ email, name, role, zoneId });
        toast.success(`Đã gửi lời mời tới ${email}`);
        setName("");
        setEmail("");
        setRole("requester");
        setZoneId(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gửi lời mời thất bại");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mời người dùng mới</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Tên</Label>
            <Input id="inv-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Vai trò</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
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
              {pending ? "Đang gửi…" : "Mời"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function UserRow({ profile, zones }: { profile: ProfileWithEmail; zones: ZoneOption[] }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role);
  const [zoneId, setZoneId] = useState<string | null>(profile.zone_id);
  const [isActive, setIsActive] = useState(profile.is_active);

  function save() {
    startTransition(async () => {
      try {
        await updateProfile({ userId: profile.id, name, role, zoneId, isActive });
        toast.success("Đã cập nhật người dùng");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="min-w-[180px]">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{profile.email ?? "—"}</TableCell>
      <TableCell>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-full min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={zoneId ?? "none"} onValueChange={(v) => setZoneId(v === "none" ? null : v)}>
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
            className="size-4 accent-primary"
          />
          {isActive ? <Badge variant="outline" className="bg-emerald-100 text-emerald-700">Hoạt động</Badge> : <Badge variant="outline" className="bg-gray-100 text-gray-500">Đã khóa</Badge>}
        </label>
      </TableCell>
      <TableCell>
        <Button variant="outline" size="sm" onClick={save} disabled={pending}>
          {pending ? "…" : "Lưu"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function UsersManager({ profiles, zones }: { profiles: ProfileWithEmail[]; zones: ZoneOption[] }) {
  return (
    <div className="space-y-4">
      <InviteForm zones={zones} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách người dùng</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Khu vực</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <UserRow key={p.id} profile={p} zones={zones} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
