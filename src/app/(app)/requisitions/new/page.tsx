import { RequisitionForm } from "@/features/requisitions/components/requisition-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewRequisitionPage() {
  const supabase = await createClient();
  const { data: zones } = await supabase.from("zones").select("*").is("deleted_at", null).order("name");

  return <RequisitionForm zones={zones ?? []} />;
}
