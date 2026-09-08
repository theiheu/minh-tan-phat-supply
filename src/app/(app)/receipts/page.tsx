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
import { ReceiptDialog } from "@/features/receipts/components/receipt-dialog";
import { SlipCodeButton } from "@/components/slip-code-button";
import { SubnavTabs } from "@/components/layout/subnav-tabs";
import { fetchCompositeVariantIds } from "@/features/products/data";
import { dayRange, formatDate } from "@/lib/format";
import { RECEIPT_STATUS, statusBadgeVariant, variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { ZoomableImage } from "@/components/image-lightbox";

type ReceiptStatus = "draft" | "approved" | "posted" | "cancelled";
const STATUSES: ReceiptStatus[] = ["draft", "approved", "posted", "cancelled"];
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

  const [{ data: suppliers }, { data: variants }, compositeIds] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("variants")
      .select("id, attributes, unit, is_trackable_lot, products(name)")
      .order("id"),
    fetchCompositeVariantIds(supabase),
  ]);

  const variantOptions = (variants ?? [])
    .filter((v) => !compositeIds.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.products?.name ?? "Vật tư",
      detail: variantLabel(v.attributes, v.unit),
      isTrackableLot: v.is_trackable_lot,
    }));

  let query = supabase
    .from("receipts")
    .select("id, code, status, created_at, invoice_images, supplier:suppliers(name), creator:profiles!receipts_created_by_fkey(name)", { count: "exact" })
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
      <SubnavTabs group="warehouse" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Lập phiếu đặt hàng / nhập kho từ nhà cung cấp — khi hàng về ghi nhận sẽ cộng tồn kho và tự động cấp phát các phiếu yêu cầu đang chờ.
        </p>
        <ReceiptDialog
          suppliers={suppliers ?? []}
          variants={variantOptions}
        />
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
              <TableHead className="w-28">Mã</TableHead>
              <TableHead className="w-16 text-center">Hóa đơn</TableHead>
              <TableHead>Nhà cung cấp</TableHead>
              <TableHead>Người lập</TableHead>
              <TableHead>Ngày</TableHead>
              <TableHead>Trạng thái</TableHead>
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
            {(data ?? []).map((r) => {
              const invoiceImages = r.invoice_images ?? [];
              return (
                <TableRow key={r.id}>
                  <TableCell className="w-28">
                    <SlipCodeButton type="receipt" id={r.id} code={r.code} />
                  </TableCell>
                  <TableCell className="w-16 text-center">
                    {invoiceImages.length > 0 ? (
                      <div className="flex items-center justify-center">
                        <div className="relative inline-flex">
                          <ZoomableImage
                            src={invoiceImages[0]}
                            images={invoiceImages}
                            alt={`Hóa đơn ${r.code}`}
                            title={`Hóa đơn mua hàng — ${r.code}`}
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
                  <TableCell className="text-muted-foreground">{r.supplier?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.creator?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(r.status)}>
                      {RECEIPT_STATUS[r.status] ?? r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
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
