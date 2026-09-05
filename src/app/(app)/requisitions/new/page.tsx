import { RequisitionForm } from "@/features/requisitions/components/requisition-form";
import { getCurrentProfile } from "@/lib/auth";
import { isPrivileged } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewRequisitionPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: zones }, { data: defects }] = await Promise.all([
    supabase.from("zones").select("*").is("deleted_at", null).order("name"),
    supabase
      .from("defect_notes")
      .select("id, code")
      .in("status", ["staging", "returned", "liquidated"])
      .order("created_at"),
  ]);

  // Danh sách tài khoản người yêu cầu (kèm tên đăng nhập) — RPC chỉ cho manager.
  const { data: accounts } =
    isPrivileged(profile?.role)
      ? await supabase.rpc("list_requester_accounts")
      : { data: null };

  return (
    <RequisitionForm
      zones={zones ?? []}
      defects={(defects ?? []).map((d) => ({ id: d.id, code: d.code }))}
      defaultZoneId={profile?.zone_id ?? null}
      currentUser={profile ? { id: profile.id, role: profile.role, name: profile.name } : null}
      accounts={accounts ?? []}
    />
  );
}
