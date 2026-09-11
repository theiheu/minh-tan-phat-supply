"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isEmailConfigured, renderNotificationEmailHtml, sendEmail } from "@/lib/email";
import { notifyUsers } from "@/lib/notifications";
import { z } from "zod";

const testEmailSchema = z.object({
  toEmail: z.string().email("Địa chỉ email người nhận không hợp lệ"),
});

const broadcastSchema = z.object({
  userIds: z.array(z.string().uuid()).optional(),
  title: z.string().min(1, "Tiêu đề thông báo không được để trống"),
  body: z.string().optional(),
  link: z.string().optional(),
  sendEmail: z.boolean().default(true),
});

const batchAssignSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Tên miền không hợp lệ (ví dụ: minhtanphat.vn)"),
  overwrite: z.boolean().default(false),
});

/**
 * Gửi email kiểm tra cấu hình SMTP & Tên miền doanh nghiệp
 */
export async function sendTestEmailAction(toEmail: string) {
  await requireManager();
  const parsed = testEmailSchema.parse({ toEmail });

  if (!isEmailConfigured()) {
    throw new Error(
      "Chưa cấu hình biến môi trường SMTP_HOST trong .env.local hoặc hệ thống. Vui lòng cấu hình SMTP trước khi gửi.",
    );
  }

  const html = renderNotificationEmailHtml({
    title: "Kiểm tra kết nối Email Doanh Nghiệp",
    body: "Chúc mừng! Cấu hình máy chủ SMTP và tên miền doanh nghiệp của hệ thống Minh Tân Phát đã hoạt động hoàn hảo.",
    link: "/dashboard",
    recipientName: "Quản trị viên",
  });

  const res = await sendEmail({
    to: parsed.toEmail,
    subject: "[MTP Supply] Thử nghiệm gửi Email Doanh Nghiệp thành công",
    html,
  });

  if (!res.success) {
    const errorMsg =
      res.error instanceof Error
        ? res.error.message
        : typeof res.error === "object" && res.error !== null
          ? JSON.stringify(res.error)
          : res.reason || "Lỗi không xác định khi gửi qua SMTP";
    throw new Error(`Gửi email thất bại: ${errorMsg}`);
  }

  return { success: true, messageId: res.messageId };
}

/**
 * Gửi thông báo (in-app + email) tới từng người dùng hoặc toàn bộ người dùng
 */
export async function broadcastNotificationAction(input: {
  userIds?: string[];
  title: string;
  body?: string;
  link?: string;
  sendEmail?: boolean;
}) {
  const profile = await requireManager();
  const parsed = broadcastSchema.parse(input);

  const supabase = await createClient();

  let targetIds = parsed.userIds;
  if (!targetIds || targetIds.length === 0) {
    const { data: allUsers } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_active", true);
    targetIds = (allUsers ?? []).map((u) => u.id);
  }

  if (targetIds.length === 0) {
    throw new Error("Không tìm thấy người dùng nào đang hoạt động.");
  }

  await notifyUsers({
    userIds: targetIds,
    type: "broadcast",
    title: parsed.title,
    body: parsed.body,
    link: parsed.link || "/dashboard",
    sendEmailNotification: parsed.sendEmail,
  });

  // Ghi audit log
  await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "notification.broadcast",
    entity_type: "notification",
    entity_id: profile.id,
    after: {
      title: parsed.title,
      recipients_count: targetIds.length,
      send_email: parsed.sendEmail,
    },
  });

  return { count: targetIds.length };
}

/**
 * Gán email doanh nghiệp hàng loạt cho người dùng theo cú pháp username@domain
 */
export async function batchAssignEmailsAction(input: { domain: string; overwrite?: boolean }) {
  await requireManager();
  const parsed = batchAssignSchema.parse(input);
  const admin = createAdminClient();

  // Lấy danh sách users
  let query = admin.from("profiles").select("id, username, email").eq("is_active", true);
  if (!parsed.overwrite) {
    query = query.is("email", null);
  }

  const { data: users, error: fetchErr } = await query;
  if (fetchErr) throw new Error(fetchErr.message);

  let updatedCount = 0;
  for (const u of users ?? []) {
    if (!u.username) continue;
    const newEmail = `${u.username.toLowerCase()}@${parsed.domain}`;
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ email: newEmail })
      .eq("id", u.id);
    if (!updateErr) {
      updatedCount++;
    }
  }

  revalidatePath("/admin/users");
  return { updatedCount, totalFound: (users ?? []).length };
}
