import Link from "next/link";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { ExchangesList } from "@/features/exchanges/components/exchanges-list";
import {
  DefectsList,
  type DefectItemRow,
  type DefectListRow,
} from "@/features/defects/components/defects-list";
import { getCurrentProfile } from "@/lib/auth";
import { dayRange } from "@/lib/format";
import { DEFECT_STATUS } from "@/lib/labels";
import { isPrivileged, isSuperuser } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { cn } from "cn";
import {
  RepairBatchTab,
  type BatchItem,
  type BatchNote,
} from "@/features/defects/components/repair-batch-tab";

type DefectStatus = "staging" | "in_repair" | "returned" | "liquidated" | "cancelled";
const STATUSES: DefectStatus[] = ["staging", "in_repair", "returned", "liquidated", "cancelled"];
const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function DefectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; location?: string; q?: string; from?: string; to?: string; page?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? null;
  const location = sp.location ?? null;
  const q = sp.q?.trim() ?? "";
  const from = sp.from ?? null;
  const to = sp.to ?? null;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const view = sp.view ?? "defect";

  const profile = await getCurrentProfile();
  const isManager = isPrivileged(profile?.role);
  const isDev = isSuperuser(profile?.role);
  const showExchange = isManager && view === "exchange";
  const showRepairBatch = isManager && view === "repair";

  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("stock_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("code");

  // ---- Tab: Tập kết sửa (manager) — gom vật tư hỏng staging nhiều HONG → 1 phiếu SC ----
  if (showRepairBatch) {
    const stagingNotes = await supabase
      .from("defect_notes")
      .select(
        "id, code, reported_by, repair_requested_at, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), defect_note_items(id, variant_id, quantity, damage_detail, note, images, variants(attributes, unit, products(name)))",
      )
      .eq("status", "staging")
      .order("created_at", { ascending: false });

    const noteRows = stagingNotes.data ?? [];

    // Loại các HONG đang có phiếu Đổi Mới sống
    const noteIds = noteRows.map((d) => d.id);
    const { data: liveEx } =
      noteIds.length > 0
        ? await supabase
            .from("exchange_notes")
            .select("linked_defect_id")
            .in("linked_defect_id", noteIds)
            .in("status", ["pending", "approved", "issued", "received"])
        : { data: [] as { linked_defect_id: string | null }[] };
    const liveNoteIds = new Set((liveEx ?? []).map((e) => e.linked_defect_id));

    // Loại các dòng đã từng đi sửa (tránh gửi trùng)
    const allItemIds = noteRows.flatMap((d) => (d.defect_note_items ?? []).map((i) => i.id));
    const { data: repairedIds } =
      allItemIds.length > 0
        ? await supabase
            .from("repair_order_items")
            .select("defect_item_id")
            .in("defect_item_id", allItemIds)
        : { data: [] as { defect_item_id: string | null }[] };
    const repairedItemIds = new Set((repairedIds ?? []).map((r) => r.defect_item_id));

    const batchNotes: BatchNote[] = [];
    const batchItems: BatchItem[] = [];
    for (const d of noteRows) {
      if (liveNoteIds.has(d.id)) continue;
      if (d.repair_requested_at) continue; // phiếu đang chờ xác nhận sửa — xử lý ở modal phiếu
      const items = (d.defect_note_items ?? [])
        .filter((i) => !repairedItemIds.has(i.id))
        .map((i) => {
          const variants = i.variants as {
            attributes?: unknown;
            unit?: string | null;
            products?: { name?: string | null } | null;
          } | null;
          return {
            id: i.id,
            noteId: d.id,
            quantity: i.quantity,
            productName: variants?.products?.name ?? null,
            variantLabel: variantLabelFor(variants),
            damageDetail: i.damage_detail,
            note: i.note,
            images: i.images ?? [],
          } satisfies BatchItem;
        });
      if (items.length === 0) continue;
      batchNotes.push({
        id: d.id,
        code: d.code,
        reporterName: d.reporter?.name ?? null,
        createdAt: d.created_at,
      });
      batchItems.push(...items);
    }

    return (
      <div className="space-y-4">
        <HeaderTabs view={view} isManager={isManager} />
        <RepairBatchTab notes={batchNotes} items={batchItems} />
      </div>
    );
  }

  // ---- Chế độ quản lý phiếu Đổi Mới (manager) ----
  if (showExchange) {
    const { data: exRows, count: exCount } = await supabase
      .from("exchange_notes")
      .select(
        "id, code, status, rejection_reason, created_at, defect:defect_notes!exchange_notes_linked_defect_id_fkey(code, reporter:profiles!defect_notes_reported_by_fkey(name)), note_items:exchange_note_items(id, quantity, variants(attributes, unit, products(name)))",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const rows = (exRows ?? []).map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      createdAt: r.created_at,
      defectCode: (r.defect as { code?: string | null } | null)?.code ?? null,
      reporterName:
        (r.defect as { reporter?: { name?: string | null } | null } | null)?.reporter?.name ?? null,
      rejectionReason: r.rejection_reason ?? null,
      items: (r.note_items ?? []).map((i) => {
        const variants = i.variants as {
          attributes?: unknown;
          unit?: string | null;
          products?: { name?: string | null } | null;
        } | null;
        return {
          id: i.id,
          quantity: i.quantity,
          productName: variants?.products?.name ?? null,
          variantLabel: variantLabelFor(variants),
        };
      }),
    }));
    return (
      <div className="space-y-4">
        <HeaderTabs view={view} isManager={isManager} />
        <p className="text-sm text-muted-foreground">
          Phiếu Đổi Mới: đổi vật tư hỏng (đã có ảnh/chứng cứ ở phiếu HONG) lấy vật tư mới.
        </p>
        <ExchangesList rows={rows} isManager={isManager} />
        <Pagination basePath="/defects" page={page} totalPages={Math.max(1, Math.ceil((exCount ?? 0) / PAGE_SIZE))} params={{ view }} />
      </div>
    );
  }

  // ---- Chế độ Phiếu hỏng (mặc định) ----
  let query = supabase
    .from("defect_notes")
    .select(
      "id, code, status, reported_by, repair_requested_at, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), source_location:stock_locations!defect_notes_source_location_id_fkey(name), defect_note_items(id, variant_id, quantity, damage_detail, note, images, variants(attributes, unit, products(name)))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && STATUSES.includes(status as DefectStatus)) query = query.eq("status", status as DefectStatus);
  if (location) query = query.eq("source_location_id", location);
  if (q) query = query.ilike("code", `%${q}%`);
  const { gte, lte } = dayRange(from, to);
  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);

  const { data, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Phiếu HONG nào đang có phiếu Đổi Mới sống → đánh dấu để modal hiển thị đúng.
  const noteIds = (data ?? []).map((d) => d.id);
  const liveByNote = new Map<string, { code: string; status: string }>();
  if (noteIds.length > 0) {
    const { data: exNotes } = await supabase
      .from("exchange_notes")
      .select("id, code, status, linked_defect_id")
      .in("linked_defect_id", noteIds)
      .in("status", ["pending", "approved", "issued", "received"]);
    for (const e of exNotes ?? []) {
      if (e.linked_defect_id) liveByNote.set(e.linked_defect_id, { code: e.code, status: e.status });
    }
  }

  const rows: DefectListRow[] = (data ?? []).map((d) => ({
    id: d.id,
    code: d.code,
    status: d.status,
    reportedById: d.reported_by ?? null,
    reporterName: d.reporter?.name ?? null,
    sourceName: d.source_location?.name ?? null,
    createdAt: d.created_at,
    repairRequested: !!d.repair_requested_at,
    liveExchange: liveByNote.get(d.id) ?? null,
    items: (d.defect_note_items ?? []).map((i) => {
      const variants = i.variants as {
        attributes?: unknown;
        unit?: string | null;
        products?: { name?: string | null } | null;
      } | null;
      return {
        id: i.id,
        quantity: i.quantity,
        damageDetail: i.damage_detail,
        note: i.note,
        images: i.images ?? [],
        productName: variants?.products?.name ?? null,
        variantLabel: variantLabelFor(variants),
      } satisfies DefectItemRow;
    }),
  }));

  const statusOptions = STATUSES.map((s) => ({ value: s, label: DEFECT_STATUS[s] }));
  const locationOptions = (locations ?? []).map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="space-y-4">
      <HeaderTabs view={view} isManager={isManager} />
      <ListFilters
        basePath="/defects"
        searchPlaceholder="Tìm mã phiếu hỏng…"
        title="Lọc phiếu hỏng"
        showDateRange
        filters={[
          { param: "status", label: "Trạng thái", options: statusOptions },
          { param: "location", label: "Kho nguồn", options: locationOptions },
        ]}
        initial={{ q, status: status ?? "", location: location ?? "", from: from ?? "", to: to ?? "" }}
      />

      <DefectsList
        rows={rows}
        currentUserId={profile?.id ?? null}
        isManager={isManager}
        isDev={isDev}
      />

      <Pagination
        basePath="/defects"
        page={page}
        totalPages={totalPages}
        params={{ q, status, location, from, to }}
      />
    </div>
  );
}

// Helper nhãn biến thể (tách để type đơn giản trong map).
function variantLabelFor(variants: {
  attributes?: unknown;
  unit?: string | null;
} | null): string {
  if (variants?.attributes && typeof variants.attributes === "object" && !Array.isArray(variants.attributes)) {
    const values = Object.values(variants.attributes as Record<string, unknown>).filter(
      (v) => typeof v === "string" && v.length > 0,
    );
    if (values.length > 0) return values.join(" · ");
  }
  return variants?.unit ?? "—";
}

/** Header tabs: Phiếu hỏng | Phiếu đổi mới | Tập kết sửa (+ nút Ghi nhận hỏng). */
function HeaderTabs({ view, isManager }: { view: string; isManager: boolean }) {
  const tabs = [
    { href: "/defects", label: "Phiếu hỏng", active: view === "defect" },
    {
      href: "/defects?view=exchange",
      label: "Phiếu đổi mới",
      active: view === "exchange",
      manager: true,
    },
    { href: "/defects?view=repair", label: "Tập kết sửa", active: view === "repair", manager: true },
  ];
  const visible = tabs.filter((t) => !t.manager || isManager);
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      {/* Kiểu tab cũ: khối bo viền, tab active nền đậm; cuộn ngang nếu chật */}
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-lg border p-0.5">
        {visible.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              t.active
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {/* Desktop: nút cùng hàng bên phải */}
      <Link
        href="/defects/new"
        className="hidden shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 lg:inline-flex"
      >
        + Ghi nhận hỏng
      </Link>
      {/* Mobile: nút xuống hàng riêng full-width */}
      <Link
        href="/defects/new"
        className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 lg:hidden"
      >
        + Ghi nhận hỏng
      </Link>
    </div>
  );
}
