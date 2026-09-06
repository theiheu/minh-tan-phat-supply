import { deleteCustomer, saveCustomer } from "@/features/admin/actions";
import { EntityCrud, type CrudRow } from "@/features/admin/components/entity-crud";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireManager();
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, address, notes")
    .is("deleted_at", null)
    .order("name");

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
    />
  );
}
