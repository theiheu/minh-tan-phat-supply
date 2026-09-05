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
import { RepairActions } from "@/features/repairs/components/repair-actions";
import { formatDate, formatVnd } from "@/lib/format";
import { REPAIR_STATUS, statusBadgeClass, variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RepairsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("repair_orders")
    .select(
      "id, code, vendor, sent_at, expected_return_at, status, total_cost, created_at, repair_order_items(id, quantity, variants(attributes, unit, products(name)))",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã</TableHead>
            <TableHead>Đơn vị sửa</TableHead>
            <TableHead>Ngày gửi</TableHead>
            <TableHead>Dự kiến về</TableHead>
            <TableHead>Chi phí</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Chưa có phiếu sửa chữa nào.
              </TableCell>
            </TableRow>
          )}
          {(data ?? []).map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-sm">{r.code}</TableCell>
              <TableCell className="text-muted-foreground">{r.vendor}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(r.sent_at)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(r.expected_return_at)}</TableCell>
              <TableCell className="tabular-nums">{r.total_cost != null ? formatVnd(r.total_cost) : "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className={statusBadgeClass(r.status)}>
                  {REPAIR_STATUS[r.status] ?? r.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <RepairActions
                    order={{
                      id: r.id,
                      status: r.status,
                      items: (r.repair_order_items ?? []).map((i) => ({
                        id: i.id,
                        label: `${i.variants?.products?.name ?? "Vật tư"} — ${variantLabel(i.variants?.attributes, i.variants?.unit)}`,
                        quantity: i.quantity,
                      })),
                    }}
                  />
                  <Link href={`/api/repairs/${r.id}/pdf`} target="_blank" className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent">
                    PDF
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
