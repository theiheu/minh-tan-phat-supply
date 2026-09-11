import { RequisitionForm } from "@/features/requisitions/components/requisition-form";
import { getCurrentProfile } from "@/lib/auth";
import { getCachedSubZones, getCachedZones } from "@/lib/cached-metadata";
import { isPrivileged } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewRequisitionPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [zones, subZones, accountsRes] = await Promise.all([
    getCachedZones(),
    getCachedSubZones(),
    isPrivileged(profile?.role)
      ? supabase.rpc("list_requester_accounts")
      : Promise.resolve({ data: null }),
  ]);
  const accounts = accountsRes.data;

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
