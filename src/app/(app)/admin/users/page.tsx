import { UsersManager } from "@/features/auth/components/users-manager";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const current = await requireManager();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();

  // Thứ tự hiển thị: superuser → manager → requester (mỗi nhóm theo created_at).
  // Hai nhóm đầu rất ít tài khoản nên tải đủ; riêng nhóm requester phân trang bằng SQL.
  const [{ data: supers }, { data: managers }, { count: requesterTotal }, { data: zones }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "superuser").order("created_at", { ascending: true }),
    supabase.from("profiles").select("*").eq("role", "manager").order("created_at", { ascending: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "requester"),
    supabase.from("zones").select("id, name").order("name"),
  ]);

  const headCount = (supers ?? []).length + (managers ?? []).length;
  const totalCount = headCount + (requesterTotal ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Lát cắt [start, end) của danh sách gộp; phần requester cần tải từ SQL.
  const start = (page - 1) * PAGE_SIZE;
  const end = page * PAGE_SIZE;
  const reqStart = Math.max(0, start - headCount);
  const reqEnd = Math.max(0, Math.min(requesterTotal ?? 0, end - headCount));

  let requesterSlice: Profile[] = [];
  if (reqEnd > reqStart) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "requester")
      .order("created_at", { ascending: true })
      .range(reqStart, reqEnd - 1);
    requesterSlice = data ?? [];
  }

  const rows = [...(supers ?? []), ...(managers ?? [])].slice(start, end).concat(requesterSlice);

  return <UsersManager profiles={rows} zones={zones ?? []} currentRole={current.role} page={page} totalPages={totalPages} />;
}
