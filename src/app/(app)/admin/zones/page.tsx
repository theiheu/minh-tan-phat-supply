import { deleteZone, saveZone } from "@/features/admin/actions";
import { EntityCrud, type CrudRow } from "@/features/admin/components/entity-crud";
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
    .select("id, name, description", { count: "exact" })
    .is("deleted_at", null)
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const rows: CrudRow[] = (data ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    description: z.description,
  }));

  return (
    <EntityCrud
      title="Khu vực"
      items={rows}
      columns={[
        { key: "name", label: "Tên" },
        { key: "description", label: "Mô tả" },
      ]}
      save={saveZone}
      remove={deleteZone}
      page={page}
      totalPages={totalPages}
      basePath="/admin/zones"
    />
  );
}
