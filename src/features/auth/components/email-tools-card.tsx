"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  sendTestEmailAction,
  broadcastNotificationAction,
  batchAssignEmailsAction,
} from "@/features/auth/actions/admin-notifications";

export function EmailToolsCard() {
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
