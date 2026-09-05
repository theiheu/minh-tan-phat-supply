"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateUsernameSchema } from "../schema";

export async function updateUsername(input: { userId: string; username: string }) {
  await requireManager();
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
