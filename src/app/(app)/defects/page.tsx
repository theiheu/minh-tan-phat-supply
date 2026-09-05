import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ListFilters } from "@/components/list-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DefectActions } from "@/features/defects/components/defect-actions";
import { dayRange, formatDate } from "@/lib/format";
import { DEFECT_STATUS, statusBadgeClass } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

type DefectStatus = "staging" | "in_repair" | "returned" | "liquidated" | "cancelled";
const STATUSES: DefectStatus[] = ["staging", "in_repair", "returned", "liquidated", "cancelled"];

export const dynamic = "force-dynamic";

export default async function DefectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; location?: string; q?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? null;
  const location = sp.location ?? null;
  const q = sp.q?.trim() ?? "";
  const from = sp.from ?? null;
  const to = sp.to ?? null;

  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("stock_locations")
    .select("id, name")
    .eq("is_active", true)
    .order("code");

  let query = supabase
    .from("defect_notes")
    .select(
      "id, code, status, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), source_location:stock_locations!defect_notes_source_location_id_fkey(name), defect_note_items(id)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && STATUSES.includes(status as DefectStatus)) query = query.eq("status", status as DefectStatus);
  if (location) query = query.eq("source_location_id", location);
  if (q) query = query.ilike("code", `%${q}%`);
  const { gte, lte } = dayRange(from, to);
  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);

  const { data } = await query;

  const statusOptions = STATUSES.map((s) => ({ value: s, label: DEFECT_STATUS[s] }));
  const locationOptions = (locations ?? []).map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="space-y-4">
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
                  <Badge variant="outline" className={statusBadgeClass(d.status)}>
                    {DEFECT_STATUS[d.status] ?? d.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <DefectActions note={{ id: d.id, status: d.status, itemIds: (d.defect_note_items ?? []).map((i) => i.id) }} />
                    <Link href="/requisitions/new" className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent">
                      Đổi mới
                    </Link>
                    <Link href={`/api/defects/${d.id}/pdf`} target="_blank" className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent">
                      PDF
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
