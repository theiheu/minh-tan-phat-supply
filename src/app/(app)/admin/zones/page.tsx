import { deleteZone, saveZone } from "@/features/admin/actions";
import { EntityCrud, type CrudRow } from "@/features/admin/components/entity-crud";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminZonesPage() {
  await requireManager();
  const supabase = await createClient();
  const { data } = await supabase.from("zones").select("id, name, description").is("deleted_at", null).order("name");

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
    />
  );
}
