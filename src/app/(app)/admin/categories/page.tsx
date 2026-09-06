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

const PAGE_SIZE = 20;

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireManager();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("categories")
    .select("id, name, icon, display_order", { count: "exact" })
    .is("deleted_at", null)
    .order("display_order")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

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
        { key: "icon", label: "Icon", kind: "icon", options: ICON_OPTIONS },
        { key: "display_order", label: "Thứ tự" },
      ]}
      save={saveCategory}
      remove={deleteCategory}
      page={page}
      totalPages={totalPages}
      basePath="/admin/categories"
    />
  );
}
