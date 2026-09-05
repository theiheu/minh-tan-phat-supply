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

export default async function AdminLocationsPage() {
  await requireManager();
  const supabase = await createClient();
  const { data } = await supabase.from("stock_locations").select("id, code, name, type").eq("is_active", true).order("code");

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
    />
  );
}
