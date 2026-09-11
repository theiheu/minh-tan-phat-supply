import { IssueForm } from "@/features/issues/components/issue-form";
import { requireManager } from "@/lib/auth";
import { getCachedCustomers, getCachedVariantOptions, getCachedZones } from "@/lib/cached-metadata";

export const dynamic = "force-dynamic";

export default async function NewIssuePage() {
  await requireManager();
  const [zones, customers, variants] = await Promise.all([
    getCachedZones(),
    getCachedCustomers(),
    getCachedVariantOptions(),
  ]);

  const variantOptions = variants.map((v) => ({
    id: v.id,
    name: v.productName,
    detail: v.detail,
    isTrackableLot: v.isTrackableLot,
    price: v.price,
  }));

  return <IssueForm zones={zones} customers={customers} variants={variantOptions} />;
}
