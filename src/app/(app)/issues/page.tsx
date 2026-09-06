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
import { requireManager } from "@/lib/auth";
import { dayRange, formatDate, formatVnd } from "@/lib/format";
import { ISSUE_DESTINATION, ISSUE_STATUS, statusBadgeClass } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

type IssueStatus = "draft" | "posted" | "cancelled";
type DestinationType = "zone" | "customer";
const STATUSES: IssueStatus[] = ["draft", "posted", "cancelled"];
const DESTINATION_TYPES: DestinationType[] = ["zone", "customer"];
const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requireManager();
  const sp = await searchParams;
  const status = sp.status ?? null;
  const type = sp.type ?? null;
  const q = sp.q?.trim() ?? "";
  const from = sp.from ?? null;
  const to = sp.to ?? null;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();

  let query = supabase
    .from("issues")
    .select(
      "id, code, destination_type, status, created_at, customer:customers(name), zone:zones(name), creator:profiles(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && STATUSES.includes(status as IssueStatus)) query = query.eq("status", status as IssueStatus);
  if (type && DESTINATION_TYPES.includes(type as DestinationType))
    query = query.eq("destination_type", type as DestinationType);
  if (q) query = query.ilike("code", `%${q}%`);
  const { gte, lte } = dayRange(from, to);
  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);

  const { data, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Tổng số lượng & thành tiền từng phiếu (chỉ tính thành tiền khi bán cho khách).
  const totals = new Map<string, { quantity: number; amount: number }>();
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from("issue_items")
      .select("issue_id, quantity, unit_price")
      .in("issue_id", ids);
    for (const it of items ?? []) {
      const t = totals.get(it.issue_id) ?? { quantity: 0, amount: 0 };
      t.quantity += it.quantity;
      t.amount += it.quantity * (it.unit_price ?? 0);
      totals.set(it.issue_id, t);
    }
  }

  const statusOptions = STATUSES.map((s) => ({ value: s, label: ISSUE_STATUS[s] }));
  const typeOptions = DESTINATION_TYPES.map((t) => ({ value: t, label: ISSUE_DESTINATION[t] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Xuất vật tư cho khu nội bộ hoặc bán cho khách — khi xác nhận xuất sẽ trừ tồn kho.
        </p>
        <Link
          href="/issues/new"
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Tạo phiếu xuất
        </Link>
      </div>

      <ListFilters
        basePath="/issues"
        searchPlaceholder="Tìm mã phiếu xuất…"
        title="Lọc phiếu xuất"
        showDateRange
        filters={[
          { param: "status", label: "Trạng thái", options: statusOptions },
          { param: "type", label: "Loại", options: typeOptions },
        ]}
        initial={{ q, status: status ?? "", type: type ?? "", from: from ?? "", to: to ?? "" }}
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã phiếu</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Bên nhận</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead className="text-right">Tổng SL</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Chưa có phiếu xuất kho nào.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((r) => {
              const isCustomer = r.destination_type === "customer";
              const total = totals.get(r.id);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/issues/${r.id}`} className="font-mono text-sm text-primary hover:underline">
                      {r.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ISSUE_DESTINATION[r.destination_type] ?? r.destination_type}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {isCustomer ? (r.customer?.name ?? "—") : (r.zone?.name ?? "—")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{total?.quantity ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {isCustomer ? formatVnd(total?.amount ?? 0) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(r.status)}>
                      {ISSUE_STATUS[r.status] ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/api/issues/${r.id}/pdf`}
                      target="_blank"
                      className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent"
                    >
                      In
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Pagination
        basePath="/issues"
        page={page}
        totalPages={totalPages}
        params={{ q, status, type, from, to }}
      />
    </div>
  );
}
