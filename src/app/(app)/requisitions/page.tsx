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
import { REQUISITION_STATUS, statusBadgeClass } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 20;
type ReqStatus = "draft" | "pending" | "approved" | "issued" | "received" | "rejected" | "cancelled";
const STATUSES: ReqStatus[] = ["draft", "pending", "approved", "issued", "received", "rejected", "cancelled"];

export const dynamic = "force-dynamic";

export default async function RequisitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? null;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();
  let query = supabase
    .from("requisitions")
    .select(
      "id, code, purpose, status, created_at, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && STATUSES.includes(status as ReqStatus)) query = query.eq("status", status as ReqStatus);

  const { data, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterTab active={!status} href="/requisitions" label="Tất cả" />
        {STATUSES.map((s) => (
          <FilterTab key={s} active={status === s} href={`/requisitions?status=${s}`} label={REQUISITION_STATUS[s]} />
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Người yêu cầu</TableHead>
              <TableHead>Khu vực</TableHead>
              <TableHead>Mục đích</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Không có phiếu yêu cầu nào.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/requisitions/${r.id}`} className="font-mono text-sm text-primary hover:underline">
                    {r.code}
                  </Link>
                </TableCell>
                <TableCell>{r.requester?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.zone?.name ?? "—"}</TableCell>
                <TableCell className="max-w-[240px] truncate text-muted-foreground">{r.purpose}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadgeClass(r.status)}>
                    {REQUISITION_STATUS[r.status] ?? r.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Link
            href={`/requisitions?${status ? `status=${status}&` : ""}page=${page - 1}`}
            className="text-sm text-primary hover:underline"
          >
            ← Trước
          </Link>
          <span className="text-sm text-muted-foreground">
            Trang {page} / {totalPages}
          </span>
          <Link
            href={`/requisitions?${status ? `status=${status}&` : ""}page=${page + 1}`}
            className="text-sm text-primary hover:underline"
          >
            Sau →
          </Link>
        </div>
      )}
    </div>
  );
}

function FilterTab({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
