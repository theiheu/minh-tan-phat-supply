import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getFuelTypes, getVehicleByQrAction } from "@/features/fuel/actions";
import { FuelQuickScan, type VehicleScanResult } from "@/features/fuel/components/fuel-quick-scan";
import { parseQrText } from "@/lib/fuel";

export const dynamic = "force-dynamic";

export default async function FuelScanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireProfile();
  const search = await searchParams;
  const rawParam =
    (typeof search?.vehicle === "string" ? search.vehicle : undefined) ||
    (typeof search?.token === "string" ? search.token : undefined) ||
    (typeof search?.code === "string" ? search.code : undefined) ||
    (typeof search?.vehicleId === "string" ? search.vehicleId : undefined) ||
    (typeof search?.v === "string" ? search.v : undefined);

  const fuelTypesPromise = getFuelTypes({ activeOnly: true });

  let initialVehicle: VehicleScanResult | null = null;
  if (rawParam) {
    try {
      const parsed = parseQrText(rawParam);
      const res = await getVehicleByQrAction(parsed.value);
      if (res) {
        initialVehicle = res as unknown as VehicleScanResult;
      }
    } catch (e) {
      console.error("Error prefetching vehicle by QR param:", e);
    }
  }

  const fuelTypes = await fuelTypesPromise;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm font-medium">Đang tải biểu mẫu cấp dầu...</p>
        </div>
      }
    >
      <FuelQuickScan
        fuelTypes={fuelTypes}
        initialVehicle={initialVehicle}
        initialQueryParam={rawParam}
      />
    </Suspense>
  );
}
