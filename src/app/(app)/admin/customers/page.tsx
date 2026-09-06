import { deleteCustomer, saveCustomer } from "@/features/admin/actions";
import { EntityCrud, type CrudRow } from "@/features/admin/components/entity-crud";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireManager();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("customers")
    .select("id, name, phone, address, notes", { count: "exact" })
    .is("deleted_at", null)
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const rows: CrudRow[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    notes: c.notes,
  }));

  return (
    <EntityCrud
      title="Khách hàng"
      items={rows}
      columns={[
        { key: "name", label: "Tên" },
        { key: "phone", label: "SĐT" },
        { key: "address", label: "Địa chỉ" },
        { key: "notes", label: "Ghi chú" },
      ]}
      save={saveCustomer}
      remove={deleteCustomer}
      page={page}
      totalPages={totalPages}
      basePath="/admin/customers"
    />
  );
}
