import { Badge } from "@/components/ui/badge";
import { formatZoneLabel } from "@/lib/format-zone";
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
import { IssueDialog } from "@/features/issues/components/issue-dialog";
import { SlipCodeButton } from "@/components/slip-code-button";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { requireManager } from "@/lib/auth";
import {
  getCachedCustomers,
  getCachedSubZones,
  getCachedVariantOptions,
  getCachedZones,
} from "@/lib/cached-metadata";
import { dayRange, formatDate, formatVnd } from "@/lib/format";
import { ISSUE_DESTINATION, ISSUE_STATUS, statusBadgeVariant } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { ZoomableImage } from "@/components/image-lightbox";

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

  const [supabase, zones, subZones, customers, variants] = await Promise.all([
    createClient(),
    getCachedZones(),
    getCachedSubZones(),
    getCachedCustomers(),
    getCachedVariantOptions(),
  ]);

  const variantOptions = variants.map((v) => ({
    id: v.id,
    name: v.productName,
    detail: v.detail,
    isTrackableLot: v.isTrackableLot,
    price: v.price,
  }));

  let query = supabase
    .from("issues")
    .select(
      "id, code, destination_type, status, invoice_images, created_at, customer:customers(name), zone:zones(name), sub_zone:sub_zones(name), creator:profiles(name)",
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
      <SubnavTabs group="warehouse" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Xuất vật tư cho khu nội bộ hoặc bán cho khách — khi xác nhận xuất sẽ trừ tồn kho.
        </p>
        <IssueDialog
          zones={zones ?? []}
          subZones={subZones ?? []}
          customers={customers ?? []}
          variants={variantOptions}
        />
      </div>

      <ListFilters
        basePath="/issues"
        searchPlaceholder="Tìm mã phiếu xuất…"
        title="Lọc phiếu xuất"
        showDateRange
        filters={[
          { param: "status", label: "Trạng thái", options: statusOptions },
          { param: "type", label: "Kiểu đích", options: typeOptions },
        ]}
        initial={{ q, status: status ?? "", type: type ?? "", from: from ?? "", to: to ?? "" }}
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã</TableHead>
              <TableHead className="w-16 text-center">Hóa đơn</TableHead>
              <TableHead>Đích xuất</TableHead>
              <TableHead>Tổng SL</TableHead>
              <TableHead>Thành tiền</TableHead>
              <TableHead>Người lập</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Chưa có phiếu xuất nào.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((r) => {
              const t = totals.get(r.id);
              const destLabel =
                r.destination_type === "zone"
                  ? formatZoneLabel(r.zone?.name, r.sub_zone?.name, "Khu nội bộ")
                  : (r.customer?.name ?? "Khách hàng");
              const invoiceImages = r.invoice_images ?? [];
              return (
                <TableRow key={r.id}>
                  <TableCell className="w-28">
                    <SlipCodeButton type="issue" id={r.id} code={r.code} />
                  </TableCell>
                  <TableCell className="w-16 text-center">
                    {invoiceImages.length > 0 ? (
                      <div className="flex items-center justify-center">
                        <div className="relative inline-flex">
                          <ZoomableImage
                            src={invoiceImages[0]}
                            images={invoiceImages}
                            alt={`Hóa đơn ${r.code}`}
                            title={`Hóa đơn xuất kho — ${r.code}`}
                            className="size-10 rounded-md border object-cover shadow-sm transition-transform hover:scale-105"
                          />
                          {invoiceImages.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-black/80 text-[9px] font-bold text-white shadow pointer-events-none">
                              +{invoiceImages.length - 1}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{destLabel}</span>
                      <span className="text-xs text-muted-foreground">
                        {ISSUE_DESTINATION[r.destination_type] ?? r.destination_type}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{t?.quantity ?? 0}</TableCell>
                  <TableCell className="tabular-nums">
                    {r.destination_type === "customer" ? formatVnd(t?.amount ?? 0) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.creator?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(r.status)}>
                      {ISSUE_STATUS[r.status] ?? r.status}
                    </Badge>
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
