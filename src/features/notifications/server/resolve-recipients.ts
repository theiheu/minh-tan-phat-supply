import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Role } from "@/lib/types";
import type {
  BusinessEventKey,
  EventParticipantMap,
  EventPolicy,
} from "./event-types";

export interface ResolvedRecipient {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface RecipientDiagnostics {
  excludedActorIds: string[];
  inactiveIds: string[];
  invalidEmailIds: string[];
  queriedRoleCount: number;
  queriedParticipantCount: number;
}

export interface ResolveRecipientsResult {
  recipients: ResolvedRecipient[];
  diagnostics: RecipientDiagnostics;
}

export interface ResolveRecipientsOptions<K extends BusinessEventKey> {
  supabase: SupabaseClient<Database>;
  policy: EventPolicy<K>;
  actorId?: string | null;
  participants?: EventParticipantMap;
}

/**
 * Kiểm tra địa chỉ email có hợp lệ để nhận thông báo SMTP qua mạng hay không.
 * Loại bỏ chuỗi rỗng, không đúng định dạng email, và các email nội bộ giả lập kết thúc bằng @mtp.local.
 */
export function isValidOutboundEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.endsWith("@mtp.local")) return false;
  // Cơ bản: có @ và dấu chấm ở domain
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Phân giải danh sách người nhận email hợp lệ từ Policy, Vai trò và Người tham gia.
 * Đảm bảo:
 * 1. Không tự động gộp superuser vào nghiệp vụ kho thông thường.
 * 2. Loại actorId nếu policy.excludeActor = true.
 * 3. Loại bỏ user không active hoặc email không hợp lệ / @mtp.local.
 * 4. Khử trùng lặp theo profile.id.
 */
export async function resolveRecipients<K extends BusinessEventKey>({
  supabase,
  policy,
  actorId,
  participants = {},
}: ResolveRecipientsOptions<K>): Promise<ResolveRecipientsResult> {
  const diagnostics: RecipientDiagnostics = {
    excludedActorIds: [],
    inactiveIds: [],
    invalidEmailIds: [],
    queriedRoleCount: 0,
    queriedParticipantCount: 0,
  };

  // Thu thập danh sách ID người tham gia từ policy.targetParticipants
  const participantIdsToFetch: string[] = [];
  for (const pKey of policy.targetParticipants) {
    const pId = participants[pKey];
    if (pId && typeof pId === "string" && pId.trim()) {
      participantIdsToFetch.push(pId.trim());
    }
  }

  // Nếu không có cả targetRoles lẫn participantIds thì trả về rỗng ngay
  if (policy.targetRoles.length === 0 && participantIdsToFetch.length === 0) {
    return { recipients: [], diagnostics };
  }

  // Chuẩn bị điều kiện query
  // Chúng ta có thể query profiles theo targetRoles HOẶC theo ID người tham gia
  let query = supabase
    .from("profiles")
    .select("id, name, email, role, is_active");

  const filterConditions: string[] = [];
  if (policy.targetRoles.length > 0) {
    // PostgREST in syntax: role.in.(role1,role2)
    filterConditions.push(`role.in.(${policy.targetRoles.join(",")})`);
    diagnostics.queriedRoleCount = policy.targetRoles.length;
  }
  if (participantIdsToFetch.length > 0) {
    filterConditions.push(`id.in.(${participantIdsToFetch.join(",")})`);
    diagnostics.queriedParticipantCount = participantIdsToFetch.length;
  }

  if (filterConditions.length === 1) {
    if (policy.targetRoles.length > 0) {
      query = query.in("role", policy.targetRoles as string[]);
    } else {
      query = query.in("id", participantIdsToFetch);
    }
  } else {
    query = query.or(filterConditions.join(","));
  }

  const { data: profiles, error } = await query;

  if (error || !profiles) {
    console.error("[resolveRecipients] Lỗi truy vấn profiles:", error);
    return { recipients: [], diagnostics };
  }

  const resolvedMap = new Map<string, ResolvedRecipient>();

  for (const p of profiles) {
    const id = p.id;

    // 1. Kiểm tra actor exclusion
    if (policy.excludeActor && actorId && id === actorId) {
      diagnostics.excludedActorIds.push(id);
      continue;
    }

    // 2. Kiểm tra active status
    if (p.is_active !== true) {
      diagnostics.inactiveIds.push(id);
      continue;
    }

    // 3. Kiểm tra email hợp lệ và không phải @mtp.local
    if (!isValidOutboundEmail(p.email)) {
      diagnostics.invalidEmailIds.push(id);
      continue;
    }

    // 4. Đảm bảo role chuẩn
    const role = (p.role ?? "requester") as Role;

    // 5. Thêm vào map để deduplicate
    if (!resolvedMap.has(id)) {
      resolvedMap.set(id, {
        id,
        name: p.name ?? "Người dùng",
        email: p.email.trim(),
        role,
      });
    }
  }

  return {
    recipients: Array.from(resolvedMap.values()),
    diagnostics,
  };
}
