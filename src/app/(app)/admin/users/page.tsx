import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { UsersManager } from "@/features/auth/components/users-manager";
import { requireSuperuser } from "@/lib/auth";
import { getCachedZones } from "@/lib/cached-metadata";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const current = await requireSuperuser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();

  // Thứ bậc vai trò ưu tiên: Quản trị hệ thống -> Chủ trại -> Kế toán -> Quản kho -> Kỹ thuật -> Người yêu cầu -> Tài xế
  const ROLE_PRIORITY: Record<string, number> = {
    superuser: 1,
    owner: 2,
    accountant: 3,
    warehouse: 4,
    technician: 5,
    requester: 6,
    driver: 7,
  };

  const [{ data: allProfiles }, zones] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    getCachedZones(),
  ]);

  const sortedProfiles = (allProfiles ?? []).sort((a, b) => {
    const pA = ROLE_PRIORITY[a.role] ?? 99;
    const pB = ROLE_PRIORITY[b.role] ?? 99;
    if (pA !== pB) return pA - pB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const totalCount = sortedProfiles.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const end = page * PAGE_SIZE;
  const rows = sortedProfiles.slice(start, end);

  return (
    <div className="space-y-4">
      <SubnavTabs group="admin" userRole={current.role} />
      <UsersManager
        profiles={rows}
        zones={zones ?? []}
        currentRole={current.role}
        currentUserId={current.id}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
