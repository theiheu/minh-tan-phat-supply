import { deactivateLocation, saveLocation } from "@/features/admin/actions";
import { EntityCrud, type CrudRow } from "@/features/admin/components/entity-crud";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TYPE_OPTIONS = [
  { value: "main", label: "Kho chính" },
  { value: "defect", label: "Kho hỏng" },
  { value: "repair", label: "Đang sửa" },
  { value: "other", label: "Khác" },
];

const PAGE_SIZE = 20;

export default async function AdminLocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireManager();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("stock_locations")
    .select("id, code, name, type", { count: "exact" })
    .eq("is_active", true)
    .order("code")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const rows: CrudRow[] = (data ?? []).map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    type: l.type,
  }));

  return (
    <EntityCrud
      title="Kho/vị trí"
      items={rows}
      columns={[
        { key: "code", label: "Mã" },
        { key: "name", label: "Tên" },
        { key: "type", label: "Loại", kind: "select", options: TYPE_OPTIONS },
      ]}
      save={saveLocation}
      remove={deactivateLocation}
      page={page}
      totalPages={totalPages}
      basePath="/admin/locations"
    />
  );
}
