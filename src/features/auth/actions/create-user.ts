"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperuser } from "@/lib/types";
import { internalEmailForUsername } from "@/lib/username";
import { createUserSchema } from "../schema";

export async function createUser(input: {
  name: string;
  username: string;
  role: string;
  zoneId: string | null;
  password: string;
}) {
  const caller = await requireManager();
  const parsed = createUserSchema.parse(input);
  // Chỉ superuser mới được tạo tài khoản superuser (UI ẩn + server chặn 2 lớp).
  if (parsed.role === "superuser" && !isSuperuser(caller.role)) {
    throw new Error("Chỉ tài khoản superuser được tạo tài khoản superuser");
  }

  const admin = createAdminClient();

  // Pre-check thân thiện (index unique vẫn là hàng rào cuối)
  const { data: dup } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", parsed.username)
    .maybeSingle();
  if (dup) throw new Error("Tên đăng nhập đã tồn tại");

  const email = internalEmailForUsername(parsed.username);
  const { error } = await admin.auth.admin.createUser({
    email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: {
      name: parsed.name,
      role: parsed.role,
      zone_id: parsed.zoneId,
      username: parsed.username,
    },
  });

  if (error) {
    // Race: unique index lower(username) chặn ở trigger handle_new_user. GoTrue
    // bọc lỗi DB thành message chung — tra lại profiles để báo chính xác.
    const { data: exists } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", parsed.username)
      .maybeSingle();
    if (exists) throw new Error("Tên đăng nhập đã tồn tại");
    throw new Error(error.message);
  }

  revalidatePath("/admin/users");
}
