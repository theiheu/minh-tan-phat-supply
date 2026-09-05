import { deleteCategory, saveCategory } from "@/features/admin/actions";
import { EntityCrud, type CrudRow } from "@/features/admin/components/entity-crud";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ICON_OPTIONS = [
  { value: "feed", label: "Thức ăn" },
  { value: "medicine", label: "Thuốc" },
  { value: "tool", label: "Dụng cụ" },
  { value: "coop", label: "Chuồng trại" },
  { value: "clean", label: "Vệ sinh" },
  { value: "ppe", label: "Bảo hộ" },
  { value: "repair", label: "Sửa chữa" },
  { value: "other", label: "Khác" },
];

export default async function AdminCategoriesPage() {
  await requireManager();
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, icon, display_order")
    .is("deleted_at", null)
    .order("display_order");

  const rows: CrudRow[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    display_order: String(c.display_order),
  }));

  return (
    <EntityCrud
      title="Danh mục"
      items={rows}
      columns={[
        { key: "name", label: "Tên" },
        { key: "icon", label: "Icon", kind: "select", options: ICON_OPTIONS },
        { key: "display_order", label: "Thứ tự" },
      ]}
      save={saveCategory}
      remove={deleteCategory}
    />
  );
}
