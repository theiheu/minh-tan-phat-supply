import { UsersManager } from "@/features/auth/components/users-manager";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const current = await requireManager();

  const supabase = await createClient();
  const [{ data: profiles }, { data: zones }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("zones").select("id, name").order("name"),
  ]);

  return <UsersManager profiles={profiles ?? []} zones={zones ?? []} currentRole={current.role} />;
}
