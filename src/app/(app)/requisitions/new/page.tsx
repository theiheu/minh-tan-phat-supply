import { RequisitionForm } from "@/features/requisitions/components/requisition-form";
import { getCurrentProfile } from "@/lib/auth";
import { isPrivileged } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewRequisitionPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: zones } = await supabase.from("zones").select("*").is("deleted_at", null).order("name");

  // Danh sách tài khoản người yêu cầu (kèm tên đăng nhập) — RPC chỉ cho manager.
  const { data: accounts } =
    isPrivileged(profile?.role)
      ? await supabase.rpc("list_requester_accounts")
      : { data: null };

  return (
    <RequisitionForm
      zones={zones ?? []}
      defaultZoneId={profile?.zone_id ?? null}
      currentUser={profile ? { id: profile.id, role: profile.role, name: profile.name } : null}
      accounts={accounts ?? []}
    />
  );
}
