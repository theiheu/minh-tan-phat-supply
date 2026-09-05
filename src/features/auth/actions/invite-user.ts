"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteUserSchema } from "../schema";

export async function inviteUser(input: {
  email: string;
  name: string;
  role: string;
  zoneId: string | null;
}) {
  await requireManager();
  const parsed = inviteUserSchema.parse(input);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.email, {
    data: { name: parsed.name, role: parsed.role, zone_id: parsed.zoneId },
    redirectTo: `${getSiteUrl()}/login`,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
  return data;
}
