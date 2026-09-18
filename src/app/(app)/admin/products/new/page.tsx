import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CatalogDraftWorkflow } from "@/features/catalog/components/draft/catalog-draft-workflow";
import { getUnits } from "@/features/catalog/data";
import { getCachedCategories } from "@/lib/cached-metadata";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const profile = await requireManager();
  const sp = await searchParams;
  const draftId = sp.draft;

  let draftData = { id: "", revision: 1, payload: {} };
  
  if (draftId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("catalog_drafts")
      .select("id, revision, payload, status")
      .eq("id", draftId)
      .eq("owner_id", profile.id)
      .eq("status", "draft")
      .single();
    if (data) {
      draftData = { id: data.id, revision: data.revision, payload: data.payload as Record<string, unknown> };
    }
  }

  const [units, categories] = await Promise.all([
    getUnits(),
    getCachedCategories(),
  ]);

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Thêm vật tư mới</h1>
        <p className="text-sm text-muted-foreground">Khai báo thông tin vật tư, đơn vị tính và quy cách đóng gói.</p>
      </div>
      <CatalogDraftWorkflow initialDraft={draftData} units={units} categories={categories} />
    </div>
  );
}
