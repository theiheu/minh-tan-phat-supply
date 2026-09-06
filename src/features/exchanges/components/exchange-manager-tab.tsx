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
import { formatDate } from "@/lib/format";
import { EXCHANGE_STATUS, statusBadgeVariant } from "@/lib/labels";

export interface ExchangeRow {
  id: string;
  code: string;
  status: string;
  created_at: string;
  defect_code: string | null;
  reporter_name: string | null;
}

export function ExchangeManagerTab({ rows }: { rows: ExchangeRow[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã</TableHead>
            <TableHead>Phiếu hỏng</TableHead>
            <TableHead>Người lập HONG</TableHead>
            <TableHead>Ngày</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Chưa có phiếu Đổi Mới nào.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-sm">{r.code}</TableCell>
              <TableCell className="font-mono text-muted-foreground">{r.defect_code ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{r.reporter_name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(r.status)}>
                  {EXCHANGE_STATUS[r.status] ?? r.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/defects/exchange/${r.id}`}
                  className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent"
                >
                  Mở
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
