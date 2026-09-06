import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DefectActions } from "@/features/defects/components/defect-actions";
import { ExchangeRequestButton } from "@/features/exchanges/components/exchange-request-button";
import { ExchangeManagerTab } from "@/features/exchanges/components/exchange-manager-tab";
import { DevDocTools } from "@/features/dev-tools/dev-doc-tools";
import { getCurrentProfile } from "@/lib/auth";
import { dayRange, formatDate } from "@/lib/format";
import { DEFECT_STATUS, EXCHANGE_STATUS, statusBadgeVariant } from "@/lib/labels";
import { isPrivileged, isSuperuser } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("stock_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("code");

  // ---- Chế độ quản lý phiếu Đổi Mới (manager) ----
  if (showExchange) {
    const { data: exRows, count: exCount } = await supabase
      .from("exchange_notes")
      .select(
        "id, code, status, created_at, defect:defect_notes!exchange_notes_linked_defect_id_fkey(code, reporter:profiles!defect_notes_reported_by_fkey(name))",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const rows = (exRows ?? []).map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      created_at: r.created_at,
      defect_code: (r.defect as { code?: string | null } | null)?.code ?? null,
      reporter_name:
        (r.defect as { reporter?: { name?: string | null } | null } | null)?.reporter?.name ?? null,
    }));
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 rounded-lg border p-0.5">
            <Link
              href="/defects"
              className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Phiếu hỏng
            </Link>
            <Link
              href="/defects?view=exchange"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Phiếu đổi mới
            </Link>
          </div>
          <Link
            href="/defects/new"
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Ghi nhận hỏng
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Phiếu Đổi Mới: đổi vật tư hỏng (đã có ảnh/chứng cứ ở phiếu HONG) lấy vật tư mới.
        </p>
        <ExchangeManagerTab rows={rows} />
        <Pagination basePath="/defects" page={page} totalPages={Math.max(1, Math.ceil((exCount ?? 0) / PAGE_SIZE))} params={{ view }} />
      </div>
    );
  }

  // ---- Chế độ Phiếu hỏng (mặc định) ----
  let query = supabase
    .from("defect_notes")
    .select(
      "id, code, status, reported_by, repair_requested_at, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), source_location:stock_locations!defect_notes_source_location_id_fkey(name), defect_note_items(id, variant_id, quantity, images)",
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

  // Phiếu HONG nào đang có phiếu Đổi Mới sống → ẩn nút tạo.
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

  const statusOptions = STATUSES.map((s) => ({ value: s, label: DEFECT_STATUS[s] }));
  const locationOptions = (locations ?? []).map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-lg border p-0.5">
          <Link
            href="/defects"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Phiếu hỏng
          </Link>
          {isManager && (
            <Link
              href="/defects?view=exchange"
              className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Phiếu đổi mới
            </Link>
          )}
        </div>
        <Link
          href="/defects/new"
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Ghi nhận hỏng
        </Link>
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

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Người báo</TableHead>
              <TableHead>Kho nguồn</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Chưa có phiếu hỏng nào.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((d) => {
              const live = liveByNote.get(d.id);
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">{d.code}</TableCell>
                  <TableCell className="text-muted-foreground">{d.reporter?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.source_location?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={statusBadgeVariant(d.status)}>
                        {DEFECT_STATUS[d.status] ?? d.status}
                      </Badge>
                      {d.repair_requested_at ? (
                        <Badge variant="warning">Chờ xác nhận sửa</Badge>
                      ) : null}
                      {live ? (
                        <Badge variant={statusBadgeVariant(live.status)}>
                          Đổi mới: {EXCHANGE_STATUS[live.status] ?? live.status}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <DefectActions
                        note={{ id: d.id, status: d.status, itemIds: (d.defect_note_items ?? []).map((i) => i.id) }}
                        isOwner={profile?.id === d.reported_by}
                        repairRequested={!!d.repair_requested_at}
                        canManage={isManager}
                      />
                      {d.status === "staging" && !live && !d.repair_requested_at && (
                        <ExchangeRequestButton noteId={d.id} isManager={isManager} />
                      )}
                      <DevDocTools kind="defect" id={d.id} code={d.code} docName="phiếu hỏng" canReopen={false} isDev={isDev} compact />                      <Link href={`/api/defects/${d.id}/pdf`} target="_blank" className="inline-flex items-center whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-primary hover:bg-accent">
                        PDF
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Pagination
        basePath="/defects"
        page={page}
        totalPages={totalPages}
        params={{ q, status, location, from, to }}
      />
    </div>
  );
}
