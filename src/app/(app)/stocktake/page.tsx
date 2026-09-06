import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { StocktakeManager } from "@/features/stocktake/components/stocktake-manager";
import type { StocktakeSessionView } from "@/features/stocktake/types";
import { requireProfile } from "@/lib/auth";
import { dayRange } from "@/lib/format";
import { STOCKTAKE_STATUS } from "@/lib/labels";
import { isSuperuser } from "@/lib/types";
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

  // Chỉ superuser (dev) mới thấy nút Mở lại sửa / Xoá phiếu.
  const profile = await requireProfile();
  const isDev = isSuperuser(profile.role);

  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("stock_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("code");

  let sessionQuery = supabase
    .from("stocktake_sessions")
    .select(
      "id, code, name, status, created_at, posted_at, location:stock_locations!stocktake_sessions_location_id_fkey(name), stocktake_items(id, checked, notes, system_qty, actual_qty, variants(attributes, unit, images, products(id, name, description, images, categories(name))))",
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
    items: (s.stocktake_items ?? []).map((i) => ({
      id: i.id,
      checked: i.checked,
      notes: i.notes ?? "",
      productId: i.variants?.products?.id ?? "",
      productName: i.variants?.products?.name ?? "Vật tư",
      description: i.variants?.products?.description ?? null,
      categoryName: i.variants?.products?.categories?.name ?? null,
      productImages: i.variants?.products?.images ?? [],
      attributes: i.variants?.attributes ?? null,
      unit: i.variants?.unit ?? null,
      variantImages: i.variants?.images ?? [],
      systemQty: i.system_qty,
      actualQty: i.actual_qty,
    })),
  }));

  const statusOptions = STATUSES.map((s) => ({ value: s, label: STOCKTAKE_STATUS[s] }));
  const locationOptions = (locations ?? []).map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="space-y-4">
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
