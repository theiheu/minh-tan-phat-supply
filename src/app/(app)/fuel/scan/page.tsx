import { requireProfile } from "@/lib/auth";
import { getFuelTypes } from "@/features/fuel/actions";
import { FuelQuickScan } from "@/features/fuel/components/fuel-quick-scan";

export const dynamic = "force-dynamic";

export default async function FuelScanPage() {
  await requireProfile();
  const fuelTypes = await getFuelTypes({ activeOnly: true });

  return <FuelQuickScan fuelTypes={fuelTypes} />;
}
