import { UsersManager } from "@/features/auth/components/users-manager";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireManager();

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: profiles }, { data: zones }, { data: authUsers }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("zones").select("id, name").order("name"),
    admin.auth.admin.listUsers(),
  ]);

  const users = (profiles ?? []).map((p) => ({
    ...p,
    email: authUsers?.users?.find((u) => u.id === p.id)?.email ?? null,
  }));

  return <UsersManager profiles={users} zones={zones ?? []} />;
}
