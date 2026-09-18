import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { StocktakeManager } from "@/features/stocktake/components/stocktake-manager";
import type { StocktakeSessionView } from "@/features/stocktake/types";
import { requireProfile } from "@/lib/auth";
import { dayRange } from "@/lib/format";
import { STOCKTAKE_STATUS } from "@/lib/labels";
import { canDeleteDoc } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type StocktakeStatus = "draft" | "posted" | "cancelled";
const STATUSES: StocktakeStatus[] = ["draft", "posted", "cancelled"];
const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function StocktakePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; location?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? null;
  const location = sp.location ?? null;
  const q = sp.q?.trim() ?? "";
  const from = sp.from ?? null;
  const to = sp.to ?? null;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  // Quản trị viên (admin/owner/superuser) có nút Mở lại sửa / Xoá phiếu.
  const profile = await requireProfile();
  const isDev = canDeleteDoc(profile.role);

  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("stock_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("code");

  let sessionQuery = supabase
    .from("stocktake_sessions")
    .select(
      "id, code, name, status, created_at, posted_at, location:stock_locations!stocktake_sessions_location_id_fkey(name), stocktake_items(id, checked, notes, system_qty, actual_qty, entered_quantity, transaction_unit_id, conversion_factor_snapshot, snapshot_quality, skus(id, sku_code, images, units(name, symbol), products(id, name, description, images, categories(name)), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol))))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && STATUSES.includes(status as StocktakeStatus)) sessionQuery = sessionQuery.eq("status", status as StocktakeStatus);
  if (location) sessionQuery = sessionQuery.eq("location_id", location);
  if (q) sessionQuery = sessionQuery.or(`code.ilike.%${q}%,name.ilike.%${q}%`);
  const { gte, lte } = dayRange(from, to);
  if (gte) sessionQuery = sessionQuery.gte("created_at", gte);
  if (lte) sessionQuery = sessionQuery.lte("created_at", lte);

  const { data: sessions, count } = await sessionQuery;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const rows: StocktakeSessionView[] = (sessions ?? []).map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name ?? null,
    locationName: s.location?.name ?? "—",
    status: s.status,
    createdAt: s.created_at,
    postedAt: s.posted_at,
    items: (s.stocktake_items ?? []).map((i) => {
      const v = i.skus as {
        id?: string;
        sku_code?: string | null;
        images?: string[] | null;
        units?: { name?: string | null; symbol?: string | null } | null;
        products?: { id: string; name?: string | null; description?: string | null; images?: string[] | null; categories?: { name?: string | null } | null } | null;
        sku_attribute_values?: Array<{
          text_value?: string | null;
          legacy_text_value?: string | null;
          numeric_value?: number | null;
          units?: { symbol?: string | null } | null;
        }> | null;
      } | null;
      const attrVals = (v?.sku_attribute_values ?? []).map(av => av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null)).filter(Boolean);
      const attrObj: Record<string, string> = {};
      if (attrVals.length > 0) attrObj["Quy cách"] = attrVals.join(" · ");
      return {
        id: i.id,
        checked: i.checked,
        notes: i.notes ?? "",
        skuId: v?.id,
        skuCode: v?.sku_code ?? undefined,
        productId: v?.products?.id ?? "",
        productName: v?.products?.name ?? "Vật tư",
        description: v?.products?.description ?? null,
        categoryName: v?.products?.categories?.name ?? null,
        productImages: v?.products?.images ?? [],
        attributes: attrVals.length > 0 ? attrObj : null,
        unit: v?.units?.symbol || v?.units?.name || null,
        variantImages: v?.images ?? [],
        systemQty: i.system_qty,
        actualQty: i.actual_qty,
        enteredQuantity: i.entered_quantity,
        transactionUnitId: i.transaction_unit_id,
        conversionFactorSnapshot: i.conversion_factor_snapshot,
        snapshotQuality: i.snapshot_quality,
      };
    }),
  }));

  const statusOptions = STATUSES.map((s) => ({ value: s, label: STOCKTAKE_STATUS[s] }));
  const locationOptions = (locations ?? []).map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="space-y-4">
      <SubnavTabs group="warehouse" />

      <ListFilters
        basePath="/stocktake"
        searchPlaceholder="Tìm tên / mã phiếu kiểm kê…"
        title="Lọc phiếu kiểm kê"
        showDateRange
        filters={[
          { param: "status", label: "Trạng thái", options: statusOptions },
          { param: "location", label: "Kho/vị trí", options: locationOptions },
        ]}
        initial={{ q, status: status ?? "", location: location ?? "", from: from ?? "", to: to ?? "" }}
      />

      <StocktakeManager sessions={rows} locations={locations ?? []} isDev={isDev} />

      <Pagination
        basePath="/stocktake"
        page={page}
        totalPages={totalPages}
        params={{ q, status, location, from, to }}
      />
    </div>
  );
}
