"use server";

import { revalidatePath } from "next/cache";
import { requireSuperuser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canDeleteUsers, isSuperuser } from "@/lib/types";

async function checkUserHasHistory(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const [
    { count: stockMovementsCount },
    { count: receiptsCount },
    { count: issuesCount },
    { count: requisitionsCount },
    { count: defectNotesCount },
    { count: toolBorrowingsCount },
    { count: fuelDispensesCount },
    { count: auditLogsCount },
  ] = await Promise.all([
    admin.from("stock_movements").select("id", { count: "exact", head: true }).eq("created_by", userId),
    admin.from("receipts").select("id", { count: "exact", head: true }).eq("created_by", userId),
    admin.from("issues").select("id", { count: "exact", head: true }).eq("creator_id", userId),
    admin
      .from("requisitions")
      .select("id", { count: "exact", head: true })
      .or(`requester_id.eq.${userId},approved_by.eq.${userId},fulfilled_by.eq.${userId}`),
    admin
      .from("defect_notes")
      .select("id", { count: "exact", head: true })
      .or(`reported_by.eq.${userId},repair_requested_by.eq.${userId},collected_by.eq.${userId}`),
    admin
      .from("tool_borrowings")
      .select("id", { count: "exact", head: true })
      .or(`borrower_id.eq.${userId},issued_by.eq.${userId}`),
    admin.from("fuel_dispenses").select("id", { count: "exact", head: true }).eq("dispenser_id", userId),
    admin.from("audit_logs").select("id", { count: "exact", head: true }).eq("actor_id", userId),
  ]);

  const reasons: string[] = [];
  if (stockMovementsCount) reasons.push(`${stockMovementsCount} biến động kho`);
  if (receiptsCount) reasons.push(`${receiptsCount} phiếu nhập`);
  if (issuesCount) reasons.push(`${issuesCount} phiếu xuất`);
  if (requisitionsCount) reasons.push(`${requisitionsCount} phiếu yêu cầu`);
  if (defectNotesCount) reasons.push(`${defectNotesCount} phiếu báo hỏng`);
  if (toolBorrowingsCount) reasons.push(`${toolBorrowingsCount} lượt mượn trả dụng cụ`);
  if (fuelDispensesCount) reasons.push(`${fuelDispensesCount} lượt cấp phát dầu`);
  if (auditLogsCount) reasons.push(`${auditLogsCount} nhật ký thao tác`);

  if (reasons.length > 0) {
    return reasons.join(", ");
  }
  return null;
}

export async function checkUserDeleteEligibility(input: { userId: string }): Promise<{
  canHardDelete: boolean;
  historyReason: string | null;
  isCallerSuperuser: boolean;
}> {
  const caller = await requireSuperuser();
  if (!canDeleteUsers(caller.role)) {
    throw new Error("Chỉ quản trị hệ thống mới có quyền thao tác");
  }

  const admin = createAdminClient();
  const historyReason = await checkUserHasHistory(admin, input.userId);
  return {
    canHardDelete: !historyReason,
    historyReason,
    isCallerSuperuser: isSuperuser(caller.role),
  };
}

export async function archiveUser(input: { userId: string }) {
  const caller = await requireSuperuser();
  if (!canDeleteUsers(caller.role)) {
    throw new Error("Chỉ quản trị hệ thống mới có quyền lưu trữ tài khoản");
  }

  if (input.userId === caller.id) {
    throw new Error("Không thể tự lưu trữ tài khoản của chính mình");
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, name, username, is_protected, is_active")
    .eq("id", input.userId)
    .single();

  if (!target) {
    throw new Error("Không tìm thấy tài khoản người dùng");
  }

  if (target.is_protected) {
    throw new Error("Không thể lưu trữ tài khoản hệ thống");
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", input.userId);

  if (error) throw new Error(error.message);

  await admin.from("audit_logs").insert({
    actor_id: caller.id,
    action: "profile.archive",
    entity_type: "profile",
    entity_id: input.userId,
    before: { name: target.name, username: target.username, is_active: target.is_active },
    after: { is_active: false },
  });

  revalidatePath("/admin/users");
}

export async function reactivateUser(input: { userId: string }) {
  const caller = await requireSuperuser();
  if (!canDeleteUsers(caller.role)) {
    throw new Error("Chỉ quản trị hệ thống mới có quyền kích hoạt lại tài khoản");
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, name, username, is_active")
    .eq("id", input.userId)
    .single();

  if (!target) {
    throw new Error("Không tìm thấy tài khoản người dùng");
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", input.userId);

  if (error) throw new Error(error.message);

  await admin.from("audit_logs").insert({
    actor_id: caller.id,
    action: "profile.reactivate",
    entity_type: "profile",
    entity_id: input.userId,
    before: { name: target.name, username: target.username, is_active: target.is_active },
    after: { is_active: true },
  });

  revalidatePath("/admin/users");
}

export async function deleteUser(input: { userId: string; force?: boolean }) {
  const caller = await requireSuperuser();
  if (!canDeleteUsers(caller.role)) {
    throw new Error("Chỉ quản trị hệ thống mới có quyền xóa tài khoản");
  }

  if (input.userId === caller.id) {
    throw new Error("Không thể tự xóa tài khoản của chính mình");
  }

  const admin = createAdminClient();

  // Kiểm tra tài khoản hệ thống (is_protected)
  const { data: target } = await admin
    .from("profiles")
    .select("id, name, username, is_protected")
    .eq("id", input.userId)
    .single();

  if (!target) {
    throw new Error("Không tìm thấy tài khoản người dùng");
  }

  if (target.is_protected) {
    throw new Error("Không thể xóa tài khoản hệ thống");
  }

  const isSuper = isSuperuser(caller.role);

  // Nếu người gọi là superuser và yêu cầu xóa sạch (force = true)
  if (isSuper && input.force) {
    const { error: purgeError } = await (admin.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)("admin_purge_user_data", {
      p_user_id: input.userId,
    });
    if (purgeError) throw new Error(purgeError.message);
  } else {
    // Kiểm tra dữ liệu lịch sử trước khi xóa thông thường
    const historyReason = await checkUserHasHistory(admin, input.userId);
    if (historyReason) {
      if (isSuper) {
        throw new Error(
          `Tài khoản này đã phát sinh dữ liệu lịch sử (${historyReason}). Với vai trò Quản trị hệ thống, bạn có thể chọn "Xóa sạch toàn bộ" để xóa cả lịch sử hoặc "Lưu trữ" để khóa tài khoản.`,
        );
      }
      throw new Error(
        `Tài khoản này đã phát sinh dữ liệu lịch sử (${historyReason}). Để bảo toàn chứng từ kế toán và sổ sách kho, không thể xóa vĩnh viễn. Vui lòng chuyển trạng thái sang "Đã khóa" (Tắt Hoạt động) để vô hiệu hóa tài khoản.`,
      );
    }
  }

  // Thực hiện xóa user qua GoTrue Admin API
  const { error } = await admin.auth.admin.deleteUser(input.userId);
  if (error) {
    if (
      error.message.includes("Database error deleting user") ||
      error.message.includes("violates foreign key") ||
      error.message.includes("foreign key constraint")
    ) {
      throw new Error(
        "Tài khoản đã có dữ liệu lịch sử liên kết trong hệ thống. Vui lòng Khóa tài khoản (Tắt trạng thái hoạt động) để vô hiệu hóa thay vì xóa vĩnh viễn.",
      );
    }
    throw new Error(error.message);
  }

  // Ghi audit log
  await admin.from("audit_logs").insert({
    actor_id: caller.id,
    action: input.force ? "profile.force_delete" : "profile.delete",
    entity_type: "profile",
    entity_id: input.userId,
    before: { name: target.name, username: target.username },
  });

  revalidatePath("/admin/users");
}
