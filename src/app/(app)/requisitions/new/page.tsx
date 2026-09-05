import { RequisitionForm } from "@/features/requisitions/components/requisition-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewRequisitionPage() {
  const supabase = await createClient();
  const [{ data: zones }, { data: defects }] = await Promise.all([
    supabase.from("zones").select("*").is("deleted_at", null).order("name"),
    supabase
      .from("defect_notes")
      .select("id, code")
      .in("status", ["staging", "returned", "liquidated"])
      .order("created_at"),
  ]);

  return <RequisitionForm zones={zones ?? []} defects={(defects ?? []).map((d) => ({ id: d.id, code: d.code }))} />;
}
