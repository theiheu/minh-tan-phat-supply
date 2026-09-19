"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUser } from "@/features/auth/actions/create-user";
import { roleOptionsFor } from "@/features/auth/utils/roles";
import type { ZoneOption } from "@/features/auth/utils/roles";

export function CreateUserDialog({
  open,
  onOpenChange,
  zones,
  currentRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zones: ZoneOption[];
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

  function resetForm() {
    setName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("requester");
    setZoneId(null);
  }

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
          subZoneId: null,
          password,
        });
        toast.success(`Đã tạo tài khoản ${username.trim().toLowerCase()}`);
        resetForm();
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo tài khoản thất bại");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản mới</DialogTitle>
            <DialogDescription>
              Tạo tài khoản nhân sự đăng nhập hệ thống bằng Tên đăng nhập và Mật khẩu. Họ tên và Tên đăng nhập sẽ được cố định sau khi tạo.
            </DialogDescription>
          </DialogHeader>

          {/* 1. Thông tin định danh cố định */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-user-name">Họ và tên *</Label>
              <Input
                id="create-user-name"
                required
                placeholder="VD: Nguyễn Văn An"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-user-username">Tên đăng nhập *</Label>
              <Input
                id="create-user-username"
                required
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="VD: nguyenvanan"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Chữ thường, số, dấu chấm/gạch dưới (cố định vĩnh viễn)
              </p>
            </div>
          </div>

          {/* 2. Mật khẩu & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-user-password">Mật khẩu khởi tạo *</Label>
              <Input
                id="create-user-password"
                type="password"
                required
                minLength={8}
                placeholder="Tối thiểu 8 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-user-email">Email (nhận thông báo)</Label>
              <Input
                id="create-user-email"
                type="email"
                placeholder="an.nv@minhtanphat.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* 3. Vai trò phân quyền */}
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

          {/* 4. Khu vực quản lý / công tác */}
          <div className="flex flex-col gap-1.5">
            <Label>Khu vực quản lý / công tác</Label>
            <Select
              value={zoneId ?? "none"}
              onValueChange={(v) => setZoneId(v === "none" ? null : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Không phân khu vực —</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang tạo…" : "Tạo tài khoản"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
