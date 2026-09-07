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
import { ReceiptActions } from "@/features/receipts/components/receipt-actions";
import { dayRange, formatDate } from "@/lib/format";
import { RECEIPT_STATUS, statusBadgeVariant } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

type ReceiptStatus = "draft" | "posted" | "cancelled";
const STATUSES: ReceiptStatus[] = ["draft", "posted", "cancelled"];
const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; supplier?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? null;
  const supplier = sp.supplier ?? null;
  const q = sp.q?.trim() ?? "";
  const from = sp.from ?? null;
  const to = sp.to ?? null;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  let query = supabase
    .from("receipts")
    .select("id, code, status, created_at, supplier:suppliers(name), creator:profiles(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && STATUSES.includes(status as ReceiptStatus)) query = query.eq("status", status as ReceiptStatus);
  if (supplier) query = query.eq("supplier_id", supplier);
  if (q) query = query.ilike("code", `%${q}%`);
  const { gte, lte } = dayRange(from, to);
  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);

  const { data, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const statusOptions = STATUSES.map((s) => ({ value: s, label: RECEIPT_STATUS[s] }));
  const supplierOptions = (suppliers ?? []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Lập phiếu nhập từ nhà cung cấp — ghi nhận sẽ cộng tồn kho và tự cấp phát các phiếu yêu cầu đang chờ.
        </p>
        <Link
          href="/receipts/new"
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Tạo phiếu nhập
        </Link>
      </div>

      <ListFilters
        basePath="/receipts"
        searchPlaceholder="Tìm mã phiếu nhập…"
        title="Lọc phiếu nhập"
        showDateRange
        filters={[
          { param: "status", label: "Trạng thái", options: statusOptions },
          { param: "supplier", label: "Nhà cung cấp", options: supplierOptions },
        ]}
        initial={{ q, status: status ?? "", supplier: supplier ?? "", from: from ?? "", to: to ?? "" }}
      />

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
                <TableCell>
                  <Link href={`/receipts/${r.id}`} className="font-mono text-sm text-primary hover:underline">
                    {r.code}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.supplier?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.creator?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(r.status)}>
                    {RECEIPT_STATUS[r.status] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <ReceiptActions id={r.id} status={r.status} />
                    <Link href={`/api/receipts/${r.id}/pdf`} target="_blank" className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent">
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
        basePath="/receipts"
        page={page}
        totalPages={totalPages}
        params={{ q, status, supplier, from, to }}
      />
    </div>
  );
}
