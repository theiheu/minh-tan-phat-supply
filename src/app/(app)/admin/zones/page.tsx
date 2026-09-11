import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { ZoneManager, type ZoneItem } from "@/features/admin/components/zone-manager";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminZonesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireManager();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("zones")
    .select(
      `
      id,
      name,
      description,
      sub_zones (
        id,
        name,
        display_order,
        deleted_at
      )
    `,
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const zoneRows: ZoneItem[] = (data ?? []).map((z) => {
    const rawSubZones = (z.sub_zones as { id: string; name: string; display_order: number; deleted_at: string | null }[]) ?? [];
    const activeSubZones = rawSubZones
      .filter((s) => s.deleted_at === null)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((s) => ({
        id: s.id,
        name: s.name,
        display_order: s.display_order,
      }));

    return {
      id: z.id,
      name: z.name,
      description: z.description,
      subZones: activeSubZones,
    };
  });

  return (
    <div className="space-y-4">
      <SubnavTabs group="admin" />
      <ZoneManager
        zones={zoneRows}
        page={page}
        totalPages={totalPages}
        basePath="/admin/zones"
      />
    </div>
  );
}
