import { RequisitionForm } from "@/features/requisitions/components/requisition-form";
import { getCurrentProfile } from "@/lib/auth";
import { isPrivileged } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewRequisitionPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: zones }, { data: subZones }, { data: accounts }] = await Promise.all([
    supabase.from("zones").select("*").is("deleted_at", null).order("name"),
    supabase.from("sub_zones").select("*").is("deleted_at", null).order("display_order"),
    isPrivileged(profile?.role)
      ? supabase.rpc("list_requester_accounts")
      : Promise.resolve({ data: null }),
  ]);

  return (
    <RequisitionForm
      zones={zones ?? []}
      subZones={subZones ?? []}
      defaultZoneId={profile?.zone_id ?? null}
      defaultSubZoneId={null}
      currentUser={profile ? { id: profile.id, role: profile.role, name: profile.name } : null}
      accounts={accounts ?? []}
    />
  );
}
