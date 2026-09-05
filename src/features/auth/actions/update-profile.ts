"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSuperuser } from "@/lib/types";
import { updateProfileSchema } from "../schema";

// Tài khoản hệ thống (is_protected) chỉ superuser được chỉnh sửa.
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

export async function updateProfile(input: {
  userId: string;
  name: string;
  role: string;
  zoneId: string | null;
  isActive: boolean;
}) {
  await assertCanMutate(input.userId);
  const parsed = updateProfileSchema.parse(input);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_profile", {
    p_user_id: parsed.userId,
    p_name: parsed.name,
    p_role: parsed.role,
    // Postgres uuid arg nhận null; generated type chỉ báo `string`.
    p_zone_id: parsed.zoneId as string,
    p_is_active: parsed.isActive,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
