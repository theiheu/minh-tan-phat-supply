"use client";

import { useState } from "react";
import { UserPlus, Users, UserX } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Profile } from "@/lib/types";

import { CreateUserDialog } from "./create-user-dialog";
import { UserRow } from "./user-row";
import { EmailToolsCard } from "./email-tools-card";
import type { ZoneOption } from "@/features/auth/utils/roles";

export function UsersManager({
  profiles,
  zones,
  currentRole,
  currentUserId,
  page = 1,
  totalPages = 1,
}: {
  profiles: Profile[];
  zones: ZoneOption[];
  currentRole: string;
  currentUserId?: string;
  /** Trang hiện tại (searchParams.page) — mặc định 1. */
  page?: number;
  /** Tổng số trang — mặc định 1 (ẩn phân trang). */
  totalPages?: number;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "archived">("active");

  const activeProfiles = profiles.filter((p) => p.is_active);
  const archivedProfiles = profiles.filter((p) => !p.is_active);

  const displayedProfiles = tab === "active" ? activeProfiles : archivedProfiles;

  return (
    <div className="space-y-4">
      <EmailToolsCard />

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
          <div>
            <CardTitle className="text-base font-semibold">Danh sách người dùng</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quản lý tài khoản, phân quyền khu vực, lưu trữ nhân sự nghỉ việc và bảo mật
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Bộ lọc Tab: Đang làm việc vs Đã nghỉ việc */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-1 text-xs">
              <button
                type="button"
                onClick={() => setTab("active")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  tab === "active"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="size-3.5" />
                <span>Đang làm việc ({`${activeProfiles.length}`})</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("archived")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  tab === "archived"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserX className="size-3.5" />
                <span>Đã nghỉ việc / Lưu trữ ({`${archivedProfiles.length}`})</span>
              </button>
            </div>

            <Button onClick={() => setCreateOpen(true)} className="gap-1.5 h-9">
              <UserPlus className="size-4" />
              <span>Tạo tài khoản</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Tên đăng nhập</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Khu vực</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                    {tab === "active"
                      ? "Không có tài khoản nào đang hoạt động."
                      : "Không có tài khoản nào trong danh sách nghỉ việc / lưu trữ."}
                  </TableCell>
                </TableRow>
              ) : (
                displayedProfiles.map((p) => (
                  <UserRow
                    key={p.id}
                    profile={p}
                    zones={zones}
                    currentRole={currentRole}
                    currentUserId={currentUserId}
                  />
                ))
              )}
            </TableBody>
          </Table>
          <Pagination basePath="/admin/users" page={page} totalPages={totalPages} className="mt-4" />
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        zones={zones}
        currentRole={currentRole}
      />
    </div>
  );
}
