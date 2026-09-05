"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "../schema";

export async function updateProfile(input: {
  userId: string;
  name: string;
  role: string;
  zoneId: string | null;
  isActive: boolean;
}) {
  await requireManager();
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
