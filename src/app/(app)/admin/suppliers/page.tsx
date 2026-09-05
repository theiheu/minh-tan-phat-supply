import { deleteSupplier, saveSupplier } from "@/features/admin/actions";
import { EntityCrud, type CrudRow } from "@/features/admin/components/entity-crud";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  await requireManager();
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("id, name, contact_name, phone, email, address").is("deleted_at", null).order("name");

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
    />
  );
}
