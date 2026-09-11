import { createClient } from "@/lib/supabase/server";
import { renderNotificationEmailHtml, sendEmail } from "./email";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface NotifyOptions {
  userIds: (string | null | undefined)[];
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  sendEmailNotification?: boolean;
}

/**
 * Lấy danh sách ID của tất cả Quản lý kho & Quản trị viên đang hoạt động
 */
export async function getManagerIds(supabaseClient?: Supabase): Promise<string[]> {
  try {
    const supabase = supabaseClient ?? (await createClient());
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["manager", "superuser"])
      .eq("is_active", true);
    return (data ?? []).map((p) => p.id);
  } catch (err) {
    console.error("[Notifications] Lỗi lấy danh sách manager IDs:", err);
    return [];
  }
}

/**
 * Gửi thông báo hợp nhất:
 * 1. Lưu thông báo vào bảng in-app notifications
 * 2. Gửi email thông báo tới người dùng có cấu hình email
 * Không bao giờ throw error làm gián đoạn nghiệp vụ chính.
 */
export async function notifyUsers(options: NotifyOptions): Promise<void> {
  const {
    userIds,
    type,
    title,
    body = null,
    link = null,
    sendEmailNotification = true,
  } = options;

  try {
    const uniqueIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
    if (uniqueIds.length === 0) return;

    const supabase = await createClient();

    // Lấy thông tin profiles của người nhận (tên, email, trạng thái hoạt động)
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, name, email, is_active")
      .in("id", uniqueIds);

    if (profileErr) {
      console.error("[Notifications] Không thể truy vấn profiles người nhận:", profileErr);
    }

    const activeRecipients = (profiles ?? []).filter((p) => p.is_active);

    // 1. Tạo thông báo in-app cho từng người nhận
    await Promise.all(
      uniqueIds.map((uid) =>
        supabase.rpc("create_notification", {
          p_user_id: uid,
          p_type: type,
          p_title: title,
          p_body: body ?? undefined,
          p_link: link ?? undefined,
        }),
      ),
    );

    // 2. Gửi email nếu bật và người dùng có email hợp lệ (không phải email nội bộ @mtp.local)
    if (sendEmailNotification) {
      const emailRecipients = activeRecipients.filter(
        (p) => p.email && p.email.trim().length > 0 && !p.email.endsWith("@mtp.local"),
      );

      if (emailRecipients.length > 0) {
        await Promise.allSettled(
          emailRecipients.map(async (recipient) => {
            const html = renderNotificationEmailHtml({
              title,
              body,
              link,
              recipientName: recipient.name,
            });

            await sendEmail({
              to: recipient.email!,
              subject: `[MTP Supply] ${title}`,
              html,
            });
          }),
        );
      }
    }
  } catch (err) {
    // Im lặng — thông báo là phụ trợ, không phá vỡ giao dịch chính
    console.error("[Notifications] Lỗi khi gửi thông báo:", err);
  }
}
