"use server";

import { revalidatePath } from "next/cache";
import { requireSuperuser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperuser } from "@/lib/types";
import { resetPasswordSchema } from "../schema";

// Chỉ tài khoản superuser mới có quyền đặt lại mật khẩu người dùng.
async function assertCanMutate(_userId: string) {
  const caller = await requireSuperuser();
  if (!isSuperuser(caller.role)) {
    throw new Error("Chỉ tài khoản superuser được đặt lại mật khẩu");
  }
  return caller;
}

export async function resetPassword(input: { userId: string; password: string }) {
  await assertCanMutate(input.userId);
  const parsed = resetPasswordSchema.parse(input);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.userId, {
    password: parsed.password,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}
