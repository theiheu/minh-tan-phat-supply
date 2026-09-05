"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resetPasswordSchema } from "../schema";

export async function resetPassword(input: { userId: string; password: string }) {
  await requireManager();
  const parsed = resetPasswordSchema.parse(input);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.userId, {
    password: parsed.password,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}
