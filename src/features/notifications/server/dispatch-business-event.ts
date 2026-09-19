import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getEventPolicy } from "./policies";
import { resolveRecipients } from "./resolve-recipients";
import type { BusinessEventInput, BusinessEventKey } from "./event-types";
import { sendEmail } from "@/lib/email";
import { renderRoleEmail } from "../templates/render-role-email";

export interface DispatchBusinessEventOptions<K extends BusinessEventKey> {
  supabase: SupabaseClient<Database>;
  input: BusinessEventInput<K>;
  skipInApp?: boolean;
  skipEmail?: boolean;
  occurrenceKey?: string;
  baseUrl?: string;
  sendEmailTransport?: (opts: { to: string; subject: string; html: string }) => Promise<any>;
}

export interface DispatchBusinessEventResult {
  inAppCount: number;
  emailAttemptCount: number;
  emailSuccessCount: number;
  emailFailureCount: number;
}

/**
 * Dispatcher trung tâm cho mọi business event trong MTP-ERP.
 * Tách biệt hoàn toàn kênh in-app notification và email notification.
 * Ghi log email_delivery_attempts và bảo đảm lỗi SMTP không throw ra ngoài.
 */
export async function dispatchBusinessEvent<K extends BusinessEventKey>({
  supabase,
  input,
  skipInApp = false,
  skipEmail = false,
  occurrenceKey = "default",
  baseUrl,
  sendEmailTransport = sendEmail,
}: DispatchBusinessEventOptions<K>): Promise<DispatchBusinessEventResult> {
  const result: DispatchBusinessEventResult = {
    inAppCount: 0,
    emailAttemptCount: 0,
    emailSuccessCount: 0,
    emailFailureCount: 0,
  };

  const policy = getEventPolicy(input.event);
  const title = policy.getSubjectTitle(input.payload);
  const link = policy.getLink(input.subject);

  // 1. Phân giải danh sách người nhận
  const { recipients } = await resolveRecipients({
    supabase,
    policy,
    actorId: input.actorId,
    participants: input.participants,
  });

  // 2. Kênh In-App Notification
  if (!skipInApp && recipients.length > 0) {
    try {
      const inAppRows = recipients.map((r) => ({
        user_id: r.id,
        type: input.subject.type,
        title,
        body: title,
        link,
      }));

      const { error: inAppError } = await supabase
        .from("notifications")
        .insert(inAppRows);

      if (inAppError) {
        console.error("[dispatchBusinessEvent] Lỗi tạo in-app notifications:", inAppError);
      } else {
        result.inAppCount = inAppRows.length;
      }
    } catch (err) {
      console.error("[dispatchBusinessEvent] Ngoại lệ khi tạo in-app notifications:", err);
    }
  }

  // 3. Kênh Email Notification (qua SMTP)
  if (!skipEmail && recipients.length > 0) {
    for (const recipient of recipients) {
      const idempotencyKey = `${input.event}:${input.subject.type}:${input.subject.id}:${recipient.id}:${occurrenceKey}`;
      result.emailAttemptCount++;

      // Ghi nhận attempt vào DB ledger
      try {
        await supabase.from("email_delivery_attempts").insert({
          idempotency_key: idempotencyKey,
          event_key: input.event,
          subject_type: input.subject.type,
          subject_id: input.subject.id,
          recipient_id: recipient.id,
          recipient_email: recipient.email,
          template_kind: policy.templateKind,
          status: "pending",
        });
      } catch (logErr) {
        console.warn("[dispatchBusinessEvent] Không thể ghi nhận delivery attempt:", logErr);
      }

      // Render HTML theo template kind và quyền hạn người nhận
      const emailHtml = renderRoleEmail({
        policy,
        recipient,
        input,
        link,
        baseUrl,
      });

      // Gửi email qua transport
      try {
        await sendEmailTransport({
          to: recipient.email,
          subject: title,
          html: emailHtml,
        });

        result.emailSuccessCount++;

        // Cập nhật trạng thái 'sent'
        await supabase
          .from("email_delivery_attempts")
          .update({
            status: "sent",
            updated_at: new Date().toISOString(),
          })
          .eq("idempotency_key", idempotencyKey);
      } catch (smtpErr: any) {
        result.emailFailureCount++;
        const errorMessage = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
        console.error(`[dispatchBusinessEvent] Lỗi gửi email tới ${recipient.email}:`, errorMessage);

        // Cập nhật trạng thái 'failed'
        try {
          await supabase
            .from("email_delivery_attempts")
            .update({
              status: "failed",
              error_message: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq("idempotency_key", idempotencyKey);
        } catch (updateErr) {
          console.error("[dispatchBusinessEvent] Không thể cập nhật trạng thái lỗi:", updateErr);
        }
      }
    }
  }

  return result;
}
