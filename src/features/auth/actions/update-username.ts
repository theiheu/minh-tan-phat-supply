"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSuperuser } from "@/lib/types";
import { updateUsernameSchema } from "../schema";

// Tài khoản hệ thống (is_protected) chỉ superuser được đổi username.
async function assertCanMutate(userId: string) {
  const caller = await requireManager();
  if (!isSuperuser(caller.role)) {
    const supabase = await createClient();
    const { data: target } = await supabase.from("profiles").select("is_protected").eq("id", userId).single();
    if (target?.is_protected) {
      throw new Error("Chỉ tài khoản superuser được thao tác trên tài khoản hệ thống");
    }
  }
  return caller;
}

export async function updateUsername(input: { userId: string; username: string }) {
  await assertCanMutate(input.userId);
  const parsed = updateUsernameSchema.parse(input);

  // Chỉ manager; đổi username KHÔNG đổi email auth.users (đăng nhập luôn tra
  // username → email qua get_login_email nên vẫn hoạt động).
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_username", {
    p_user_id: parsed.userId,
    p_username: parsed.username,
  });
  if (error) {
    if (/duplicate key|23505/i.test(error.message)) throw new Error("Tên đăng nhập đã tồn tại");
    throw new Error(error.message);
  }

  revalidatePath("/admin/users");
}
