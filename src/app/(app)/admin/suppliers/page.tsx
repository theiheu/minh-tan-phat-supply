import { deleteSupplier, saveSupplier } from "@/features/admin/actions";
import { EntityCrud, type CrudRow } from "@/features/admin/components/entity-crud";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireManager();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("suppliers")
    .select("id, name, contact_name, phone, email, address", { count: "exact" })
    .is("deleted_at", null)
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const rows: CrudRow[] = (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    contact_name: s.contact_name,
    phone: s.phone,
    email: s.email,
    address: s.address,
  }));

  return (
    <EntityCrud
      title="Nhà cung cấp"
      items={rows}
      columns={[
        { key: "name", label: "Tên" },
        { key: "contact_name", label: "Liên hệ" },
        { key: "phone", label: "Điện thoại" },
        { key: "email", label: "Email" },
        { key: "address", label: "Địa chỉ" },
      ]}
      save={saveSupplier}
      remove={deleteSupplier}
      page={page}
      totalPages={totalPages}
      basePath="/admin/suppliers"
    />
  );
}
