import { DefectForm } from "@/features/defects/components/defect-form";
import { getCachedStockLocations } from "@/lib/cached-metadata";

export const dynamic = "force-dynamic";

export default async function NewDefectPage() {
  const locations = await getCachedStockLocations();
  const main = locations.filter((l) => l.type === "main");
  const sourceLocationId =
    main.find((l) => l.code === "KHO_CHINH")?.id ?? main[0]?.id ?? "";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-1">
      <DefectForm sourceLocationId={sourceLocationId} />
    </div>
  );
}
