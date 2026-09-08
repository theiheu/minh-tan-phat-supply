import Link from "next/link";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { DefectDialog } from "@/features/defects/components/defect-dialog";
import {
  DefectsList,
  type DefectItemRow,
  type DefectListRow,
} from "@/features/defects/components/defects-list";
import { fetchCompositeVariantIds } from "@/features/products/data";
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
  searchParams: Promise<{
    status?: string;
    location?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
    view?: string;
    tab?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? null;
  const location = sp.location ?? null;
  const q = sp.q?.trim() ?? "";
  const from = sp.from ?? null;
  const to = sp.to ?? null;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const view = sp.view ?? "defect";
  const tab = sp.tab ?? "all";

  const profile = await getCurrentProfile();
  const isManager = isPrivileged(profile?.role);
  const isDev = isSuperuser(profile?.role);
  const showRepairBatch = isManager && view === "repair";

  const supabase = await createClient();

  const [{ data: locations }, mainLocations, { data: allVariants }, compositeIds] = await Promise.all([
    supabase
      .from("stock_locations")
      .select("id, name")
      .eq("is_active", true)
      .order("code"),
    supabase
      .from("stock_locations")
      .select("id, code, name")
      .eq("type", "main")
      .eq("is_active", true)
      .order("code"),
    supabase.from("variants").select("id, attributes, unit, products(name)").order("id"),
    fetchCompositeVariantIds(supabase),
  ]);

  const main = mainLocations.data ?? [];
  const sourceLocationId =
    main.find((l) => l.code === "KHO_CHINH")?.id ?? main[0]?.id ?? "";

  const defectVariantOptions = (allVariants ?? [])
    .filter((v) => !compositeIds.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.products?.name ?? "Vật tư",
      detail: variantLabelFor(v),
    }));

  // ---- Tab: Kho đồ hỏng (manager) — gom vật tư hỏng staging nhiều HONG → 1 phiếu SC ----
  if (showRepairBatch) {
    const stagingNotes = await supabase
      .from("defect_notes")
      .select(
        "id, code, reported_by, repair_requested_at, collected_at, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), defect_note_items(id, variant_id, quantity, damage_detail, note, images, variants(attributes, unit, products(name)))",
      )
      .eq("status", "staging")
      .order("created_at", { ascending: false });

    const noteRows = stagingNotes.data ?? [];

    // Loại các HONG đang có phiếu Đổi Mới đã nhận hoàn tất
    const noteIds = noteRows.map((d) => d.id);
    const { data: liveEx } =
      noteIds.length > 0
        ? await supabase
            .from("exchange_notes")
            .select("linked_defect_id")
            .in("linked_defect_id", noteIds)
            .in("status", ["received"])
        : { data: [] as { linked_defect_id: string | null }[] };
    const receivedExNoteIds = new Set((liveEx ?? []).map((e) => e.linked_defect_id));

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
      if (receivedExNoteIds.has(d.id)) continue;
      const rawDefect = d as unknown as { collected_at?: string | null };
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
        isCollected: Boolean(rawDefect.collected_at),
        collectedAt: rawDefect.collected_at ?? null,
        repairRequested: Boolean(d.repair_requested_at),
      });
      batchItems.push(...items);
    }

    return (
      <div className="space-y-4">
        <SubnavTabs group="defects" userRole={profile?.role} />
        <HeaderTabs
          view={view}
          isManager={isManager}
          sourceLocationId={sourceLocationId}
          variants={defectVariantOptions}
        />
        <RepairBatchTab notes={batchNotes} items={batchItems} />
      </div>
    );
  }

  // ---- Chế độ Phiếu hỏng (mặc định) ----
  // Lấy các phiếu đổi mới đang sống (pending, approved, issued) và đã nhận để phân loại tiến trình
  const [{ data: liveExNotes }, { data: receivedExNotes }] = await Promise.all([
    supabase
      .from("exchange_notes")
      .select("linked_defect_id, status")
      .in("status", ["pending", "approved", "issued"]),
    supabase
      .from("exchange_notes")
      .select("linked_defect_id")
      .eq("status", "received"),
  ]);

  const activeExDefectIds = new Set(
    (liveExNotes ?? []).map((e) => e.linked_defect_id).filter(Boolean) as string[],
  );
  const receivedExDefectIds = new Set(
    (receivedExNotes ?? []).map((e) => e.linked_defect_id).filter(Boolean) as string[],
  );

  // Đếm số lượng theo các nhóm tiến trình
  const [
    { count: totalAll },
    { data: stagingNotesForCount },
    { count: totalInRepair },
    { count: totalTerminal },
  ] = await Promise.all([
    supabase.from("defect_notes").select("id", { count: "exact", head: true }),
    supabase.from("defect_notes").select("id, repair_requested_at, collected_at").eq("status", "staging"),
    supabase.from("defect_notes").select("id", { count: "exact", head: true }).eq("status", "in_repair"),
    supabase
      .from("defect_notes")
      .select("id", { count: "exact", head: true })
      .in("status", ["returned", "liquidated", "cancelled"]),
  ]);

  const stagingList = stagingNotesForCount ?? [];
  const notCollectedCount = stagingList.filter((r) => !r.collected_at).length;
  const inWarehouseCount = stagingList.filter((r) => Boolean(r.collected_at)).length;
  const stagingRepairReqCount = stagingList.filter((r) => r.repair_requested_at).length;

  const counts = {
    all: totalAll ?? 0,
    not_collected: notCollectedCount,
    in_warehouse: inWarehouseCount,
    exchanging: activeExDefectIds.size,
    repairing: (totalInRepair ?? 0) + stagingRepairReqCount,
    completed: (totalTerminal ?? 0) + receivedExDefectIds.size,
  };

  let query = supabase
    .from("defect_notes")
    .select(
      "id, code, status, reported_by, repair_requested_at, collected_at, collected_by, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), source_location:stock_locations!defect_notes_source_location_id_fkey(name), defect_note_items(id, variant_id, quantity, damage_detail, note, images, variants(attributes, unit, products(name)))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (tab === "not_collected") {
    query = query.eq("status", "staging").is("collected_at", null);
  } else if (tab === "in_warehouse") {
    query = query.eq("status", "staging").not("collected_at", "is", null);
  } else if (tab === "exchanging") {
    if (activeExDefectIds.size > 0) {
      query = query.in("id", Array.from(activeExDefectIds));
    } else {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  } else if (tab === "repairing") {
    query = query.or("status.eq.in_repair,repair_requested_at.not.is.null");
  } else if (tab === "completed") {
    if (receivedExDefectIds.size > 0) {
      query = query.or(
        `status.in.(returned,liquidated,cancelled),id.in.(${Array.from(receivedExDefectIds).join(",")})`,
      );
    } else {
      query = query.in("status", ["returned", "liquidated", "cancelled"]);
    }
  } else if (status && STATUSES.includes(status as DefectStatus)) {
    query = query.eq("status", status as DefectStatus);
  }

  if (location) query = query.eq("source_location_id", location);
  if (q) query = query.ilike("code", `%${q}%`);
  const { gte, lte } = dayRange(from, to);
  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);

  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Phiếu HONG nào đang có phiếu Đổi Mới → lấy thông tin phiếu đổi mới mới nhất để modal hiển thị và thao tác.
  const noteIds = (data ?? []).map((d) => d.id);
  const liveByNote = new Map<string, { id: string; code: string; status: string; rejectionReason: string | null }>();
  if (noteIds.length > 0) {
    const { data: exNotes } = await supabase
      .from("exchange_notes")
      .select("id, code, status, linked_defect_id, rejection_reason")
      .in("linked_defect_id", noteIds)
      .order("created_at", { ascending: false });
    for (const e of exNotes ?? []) {
      if (e.linked_defect_id && !liveByNote.has(e.linked_defect_id)) {
        liveByNote.set(e.linked_defect_id, {
          id: e.id,
          code: e.code,
          status: e.status,
          rejectionReason: e.rejection_reason ?? null,
        });
      }
    }
  }

  const rows: DefectListRow[] = (data ?? []).map((d) => {
    const rawDefect = d as unknown as {
      source_location_id?: string | null;
      collected_at?: string | null;
    };
    return {
      id: d.id,
      code: d.code,
      status: d.status,
      sourceLocationId: rawDefect.source_location_id ?? null,
      reportedById: d.reported_by ?? null,
      reporterName: d.reporter?.name ?? null,
      sourceName: d.source_location?.name ?? null,
      createdAt: d.created_at,
      collectedAt: rawDefect.collected_at ?? null,
      isCollected: Boolean(rawDefect.collected_at),
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
          variantId: i.variant_id,
          quantity: i.quantity,
          damageDetail: i.damage_detail,
          note: i.note,
          images: i.images ?? [],
          productName: variants?.products?.name ?? null,
          variantLabel: variantLabelFor(variants),
        } satisfies DefectItemRow;
      }),
    };
  });

  const statusOptions = STATUSES.map((s) => ({ value: s, label: DEFECT_STATUS[s] }));
  const locationOptions = (locations ?? []).map((l) => ({ value: l.id, label: l.name }));

  const quickFilterTabs = [
    { key: "all", label: "Tất cả", count: counts.all },
    { key: "not_collected", label: "Chưa về kho", count: counts.not_collected, tone: "danger" },
    { key: "in_warehouse", label: "Đã về kho (Chờ xử lý)", count: counts.in_warehouse, tone: "success" },
    { key: "exchanging", label: "Đang đổi mới", count: counts.exchanging, tone: "info" },
    { key: "repairing", label: "Đang sửa", count: counts.repairing, tone: "warning" },
    { key: "completed", label: "Đã hoàn tất", count: counts.completed, tone: "neutral" },
  ];

  return (
    <div className="space-y-4">
      <SubnavTabs group="defects" userRole={profile?.role} />

      <HeaderTabs
        view={view}
        isManager={isManager}
        sourceLocationId={sourceLocationId}
        variants={defectVariantOptions}
      />

      {/* Quick filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {quickFilterTabs.map((t) => {
          const isActive = tab === t.key || (t.key === "all" && !sp.tab);
          const nextParams: Record<string, string | undefined> = {
            ...sp,
            tab: t.key === "all" ? undefined : t.key,
            page: undefined,
          };
          const qs = buildQueryString(nextParams);
          const href = qs ? `/defects?${qs}` : "/defects";
          return (
            <Link
              key={t.key}
              href={href}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground border-border",
              )}
            >
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : t.tone === "danger" && t.count > 0
                        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                        : t.tone === "info" && t.count > 0
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                          : t.tone === "warning" && t.count > 0
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                            : "bg-muted text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

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
        variants={defectVariantOptions}
        sourceLocationId={sourceLocationId}
      />

      <Pagination
        basePath="/defects"
        page={page}
        totalPages={totalPages}
        params={{ q, status, location, from, to, tab: tab !== "all" ? tab : undefined }}
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

function buildQueryString(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim()) q.set(k, v.trim());
  }
  return q.toString();
}

/** Header tabs: Phiếu hỏng | Kho đồ hỏng (+ nút Ghi nhận hỏng). */
function HeaderTabs({
  view,
  isManager,
  sourceLocationId,
  variants,
}: {
  view: string;
  isManager: boolean;
  sourceLocationId: string;
  variants: { id: string; name: string; detail: string }[];
}) {
  const tabs = [
    { href: "/defects", label: "Phiếu hỏng", active: view === "defect" },
    { href: "/defects?view=repair", label: "Kho đồ hỏng", active: view === "repair", manager: true },
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
      <DefectDialog
        sourceLocationId={sourceLocationId}
        variants={variants}
      />
    </div>
  );
}
