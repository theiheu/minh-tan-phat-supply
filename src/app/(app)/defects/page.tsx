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
import { ExchangeRequestButton } from "@/features/defects/components/exchange-request-button";
import { DevDocTools } from "@/features/dev-tools/dev-doc-tools";
import { getCurrentProfile } from "@/lib/auth";
import { dayRange, formatDate } from "@/lib/format";
import { DEFECT_STATUS, statusBadgeVariant } from "@/lib/labels";
import { isSuperuser } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type DefectStatus = "staging" | "in_repair" | "returned" | "liquidated" | "cancelled";
const STATUSES: DefectStatus[] = ["staging", "in_repair", "returned", "liquidated", "cancelled"];
const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function DefectsPage({
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

  const profile = await getCurrentProfile();
  const isDev = isSuperuser(profile?.role);

  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("stock_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("code");

  let query = supabase
    .from("defect_notes")
    .select(
      "id, code, status, reported_by, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), source_location:stock_locations!defect_notes_source_location_id_fkey(name), defect_note_items(id, variant_id, quantity, images)",
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

  // Phiếu hỏng nào đang có yêu cầu Đổi mới sống → ẩn nút tạo yêu cầu.
  const noteIds = (data ?? []).map((d) => d.id);
  const { data: activeReqs } =
    noteIds.length > 0
      ? await supabase
          .from("requisitions")
          .select("linked_defect_id")
          .in("linked_defect_id", noteIds)
          .in("status", ["draft", "pending", "approved", "issued", "received"])
      : { data: [] as { linked_defect_id: string | null }[] };
  const activeNoteIds = new Set((activeReqs ?? []).map((r) => r.linked_defect_id));

  const statusOptions = STATUSES.map((s) => ({ value: s, label: DEFECT_STATUS[s] }));
  const locationOptions = (locations ?? []).map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Ghi nhận vật tư hỏng để đưa đi sửa, thanh lý hoặc tạo yêu cầu đổi mới.</p>
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
            {(data ?? []).map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-sm">{d.code}</TableCell>
                <TableCell className="text-muted-foreground">{d.reporter?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{d.source_location?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(d.status)}>
                    {DEFECT_STATUS[d.status] ?? d.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <DefectActions note={{ id: d.id, status: d.status, itemIds: (d.defect_note_items ?? []).map((i) => i.id) }} />
                    <ExchangeRequestButton noteId={d.id} disabled={d.status !== "staging" || activeNoteIds.has(d.id)} />
                    <DevDocTools kind="defect" id={d.id} code={d.code} docName="phiếu hỏng" canReopen={false} isDev={isDev} compact />
                    <Link href={`/api/defects/${d.id}/pdf`} target="_blank" className="inline-flex items-center whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-primary hover:bg-accent">
                      PDF
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
