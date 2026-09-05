import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DefectActions } from "@/features/defects/components/defect-actions";
import { formatDate } from "@/lib/format";
import { DEFECT_STATUS, statusBadgeClass } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DefectsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("defect_notes")
    .select(
      "id, code, status, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), source_location:stock_locations!defect_notes_source_location_id_fkey(name), defect_note_items(id)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
