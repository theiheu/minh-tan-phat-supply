import Link from "next/link";
import { QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RepairActions } from "@/features/repairs/components/repair-actions";
import { DevDocTools } from "@/features/dev-tools/dev-doc-tools";
import { getCurrentProfile } from "@/lib/auth";
import { dayRange, formatDate, formatVnd } from "@/lib/format";
import { REPAIR_STATUS, statusBadgeVariant, variantLabel } from "@/lib/labels";
import { isSuperuser } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

type RepairStatus = "in_repair" | "returned" | "cancelled";
const STATUSES: RepairStatus[] = ["in_repair", "returned", "cancelled"];
const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? null;
  const q = sp.q?.trim() ?? "";
  const from = sp.from ?? null;
  const to = sp.to ?? null;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const profile = await getCurrentProfile();
  const isDev = isSuperuser(profile?.role);

  const supabase = await createClient();

  let query = supabase
    .from("repair_orders")
    .select(
      "id, code, vendor, sent_at, expected_return_at, status, total_cost, created_at, repair_order_items(id, quantity, variants(attributes, unit, products(name)))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && STATUSES.includes(status as RepairStatus)) query = query.eq("status", status as RepairStatus);
  if (q) query = query.or(`code.ilike.%${q}%,vendor.ilike.%${q}%`);
  const { gte, lte } = dayRange(from, to);
  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);

  const { data, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const statusOptions = STATUSES.map((s) => ({ value: s, label: REPAIR_STATUS[s] }));

  return (
    <div className="space-y-4">
      <SubnavTabs group="defects" />

      <ListFilters
        basePath="/repairs"
        searchPlaceholder="Tìm mã phiếu, đơn vị sửa…"
        title="Lọc phiếu sửa chữa"
        showDateRange
        filters={[{ param: "status", label: "Trạng thái", options: statusOptions }]}
        initial={{ q, status: status ?? "", from: from ?? "", to: to ?? "" }}
      />

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
                  <Badge variant={statusBadgeVariant(r.status)}>
                    {REPAIR_STATUS[r.status] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
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
                    <DevDocTools kind="repair" id={r.id} code={r.code} docName="phiếu sửa" canReopen={r.status === "returned"} isDev={isDev} compact />
                    <Link href={`/qr/repair/${r.id}`} target="_blank" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary hover:bg-accent">
                      <QrCode className="size-4" aria-hidden />
                      In mã QR
                    </Link>
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

      <Pagination
        basePath="/repairs"
        page={page}
        totalPages={totalPages}
        params={{ q, status, from, to }}
      />
    </div>
  );
}
