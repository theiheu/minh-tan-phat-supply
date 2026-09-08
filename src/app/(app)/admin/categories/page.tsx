import { deleteCategory, saveCategory } from "@/features/admin/actions";
import { EntityCrud, type CrudRow } from "@/features/admin/components/entity-crud";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ICON_OPTIONS = [
  { value: "electric", label: "Điện - Điện tử" },
  { value: "machinery", label: "Phụ tùng Xe - Máy móc" },
  { value: "tools_ppe", label: "Dụng cụ - Bảo hộ" },
  { value: "livestock", label: "Thiết bị Chăn nuôi" },
  { value: "plumbing_pneumatics", label: "Nước - Khí nén" },
  { value: "bearings", label: "Vòng bi - Bạc đạn" },
  { value: "belts_chains", label: "Dây curoa - Nhông xích" },
  { value: "oil_chemicals", label: "Dầu mỡ - Hóa chất" },
  { value: "welding_cutting", label: "Hàn - Cắt - Gia công" },
  { value: "hardware_fasteners", label: "Kim khí - Bulong - Ốc vít" },
  { value: "packaging_ropes", label: "Đóng gói - Bạt - Dây" },
  { value: "other", label: "Vật tư Khác" },
  { value: "tool", label: "Dụng cụ (Cờ lê)" },
  { value: "repair", label: "Sửa chữa (Búa)" },
  { value: "ppe", label: "Bảo hộ (Khiên)" },
  { value: "clean", label: "Vệ sinh (Lấp lánh)" },
  { value: "medicine", label: "Thuốc thú y (Viên thuốc)" },
  { value: "coop", label: "Chuồng trại (Ngôi nhà)" },
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
