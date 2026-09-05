import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiptActions } from "@/features/receipts/components/receipt-actions";
import { formatDate } from "@/lib/format";
import { RECEIPT_STATUS, statusBadgeClass } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receipts")
    .select("id, code, status, created_at, supplier:suppliers(name), creator:profiles(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã</TableHead>
            <TableHead>Nhà cung cấp</TableHead>
            <TableHead>Người lập</TableHead>
            <TableHead>Ngày</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Chưa có phiếu nhập kho nào.
              </TableCell>
            </TableRow>
          )}
          {(data ?? []).map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-sm">{r.code}</TableCell>
              <TableCell className="text-muted-foreground">{r.supplier?.name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{r.creator?.name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={statusBadgeClass(r.status)}>
                  {RECEIPT_STATUS[r.status] ?? r.status}
                </Badge>
              </TableCell>
              <TableCell>
                <ReceiptActions id={r.id} status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
