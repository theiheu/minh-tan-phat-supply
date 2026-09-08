import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { SlipCodeButton } from "@/components/slip-code-button";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { RequisitionDialog } from "@/features/requisitions/components/requisition-dialog";
import { getCurrentProfile } from "@/lib/auth";
import { dayRange, formatDate } from "@/lib/format";
import { REQUISITION_STATUS, REQUISITION_TYPE, statusBadgeVariant } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { isPrivileged } from "@/lib/types";

const PAGE_SIZE = 20;
type ReqStatus = "draft" | "pending" | "approved" | "issued" | "received" | "rejected" | "cancelled";
const STATUSES: ReqStatus[] = ["draft", "pending", "approved", "issued", "received", "rejected", "cancelled"];

export const dynamic = "force-dynamic";

export default async function RequisitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; zone?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? null;
  const zone = sp.zone ?? null;
  const q = sp.q?.trim() ?? "";
  const from = sp.from ?? null;
  const to = sp.to ?? null;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: zones }, { data: accounts }] = await Promise.all([
    supabase.from("zones").select("*").is("deleted_at", null).order("name"),
    isPrivileged(profile?.role)
      ? supabase.rpc("list_requester_accounts")
      : Promise.resolve({ data: null }),
  ]);

  let query = supabase
    .from("requisitions")
    .select(
      "id, code, purpose, status, requisition_type, created_at, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && STATUSES.includes(status as ReqStatus)) query = query.eq("status", status as ReqStatus);
  if (zone) query = query.eq("zone_id", zone);
  if (q) query = query.or(`code.ilike.%${q}%,purpose.ilike.%${q}%`);
  const { gte, lte } = dayRange(from, to);
  if (gte) query = query.gte("created_at", gte);
  if (lte) query = query.lte("created_at", lte);

  const { data, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const statusOptions = STATUSES.map((s) => ({ value: s, label: REQUISITION_STATUS[s] }));
  const zoneOptions = (zones ?? []).map((z) => ({ value: z.id, label: z.name }));

  return (
    <div className="space-y-4">
      <SubnavTabs group="requisitions" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Danh sách phiếu yêu cầu vật tư từ các khu vực hoạt động.
        </p>
        <RequisitionDialog
          zones={zones ?? []}
          defaultZoneId={profile?.zone_id ?? null}
          currentUser={profile ? { id: profile.id, role: profile.role, name: profile.name } : null}
          accounts={accounts ?? []}
        />
      </div>

      <ListFilters
        basePath="/requisitions"
        searchPlaceholder="Tìm mã phiếu, mục đích…"
        title="Lọc phiếu yêu cầu"
        showDateRange
        filters={[
          { param: "status", label: "Trạng thái", options: statusOptions },
          { param: "zone", label: "Khu vực", options: zoneOptions },
        ]}
        initial={{ q, status: status ?? "", zone: zone ?? "", from: from ?? "", to: to ?? "" }}
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Người yêu cầu</TableHead>
              <TableHead>Khu vực</TableHead>
              <TableHead>Mục đích</TableHead>
              <TableHead className="hidden md:table-cell">Loại</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Không có phiếu yêu cầu nào.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <SlipCodeButton type="requisition" id={r.id} code={r.code} />
                </TableCell>
                <TableCell>{r.requester?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.zone?.name ?? "—"}</TableCell>
                <TableCell className="max-w-[240px] truncate text-muted-foreground">{r.purpose}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {REQUISITION_TYPE[r.requisition_type] ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(r.status)}>
                    {REQUISITION_STATUS[r.status] ?? r.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        basePath="/requisitions"
        page={page}
        totalPages={totalPages}
        params={{ q, status, zone, from, to }}
      />
    </div>
  );
}
