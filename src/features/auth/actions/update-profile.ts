"use server";

import { revalidatePath } from "next/cache";
import { requireSuperuser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSuperuser } from "@/lib/types";
import { updateProfileSchema } from "../schema";

// Chỉ tài khoản superuser mới có quyền cập nhật người dùng và phân quyền.
async function assertCanMutate(_userId: string) {
  const caller = await requireSuperuser();
  if (!isSuperuser(caller.role)) {
    throw new Error("Chỉ tài khoản superuser mới có quyền cập nhật người dùng");
  }
  return caller;
}

export async function updateProfile(input: {
  userId: string;
  name: string;
  email?: string | null;
  role: string;
  zoneId: string | null;
  subZoneId?: string | null;
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
    p_zone_id: (parsed.zoneId ?? null) as unknown as string,
    p_is_active: parsed.isActive,
    p_sub_zone_id: (parsed.subZoneId ?? null) as unknown as string,
    p_email: parsed.email ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
