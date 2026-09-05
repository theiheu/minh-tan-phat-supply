import { UsersManager } from "@/features/auth/components/users-manager";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const current = await requireManager();

  const supabase = await createClient();
  const [{ data: profiles }, { data: zones }] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("zones").select("id, name").order("name"),
  ]);

  // Ưu tiên hiển thị: superuser (tài khoản hệ thống) lên đầu, kế đến manager,
  // rồi requester — trong từng nhóm giữ thứ tự tạo.
  const roleRank = { superuser: 0, manager: 1, requester: 2 };
  const sorted = [...(profiles ?? [])].sort(
    (a, b) =>
      (roleRank[a.role as keyof typeof roleRank] ?? 3) - (roleRank[b.role as keyof typeof roleRank] ?? 3) ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return <UsersManager profiles={sorted} zones={zones ?? []} currentRole={current.role} />;
}
