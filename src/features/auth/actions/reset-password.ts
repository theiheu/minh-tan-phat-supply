"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperuser } from "@/lib/types";
import { resetPasswordSchema } from "../schema";

// Tài khoản hệ thống (is_protected) chỉ superuser được đặt lại mật khẩu.
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
