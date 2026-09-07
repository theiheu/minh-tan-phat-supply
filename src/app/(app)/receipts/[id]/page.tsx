import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiptActions } from "@/features/receipts/components/receipt-actions";
import { DevDocTools } from "@/features/dev-tools/dev-doc-tools";
import { getCurrentProfile } from "@/lib/auth";
import { formatDate, formatVnd } from "@/lib/format";
import { RECEIPT_STATUS, REQUISITION_STATUS, statusBadgeVariant, variantLabel } from "@/lib/labels";
import { isPrivileged, isSuperuser } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { ReceiptInvoices } from "@/features/receipts/components/receipt-invoices";

export const dynamic = "force-dynamic";

const AUDIT_LABELS: Record<string, string> = {
  "receipt.create": "Tạo phiếu đặt hàng",
  "receipt.update": "Kiểm đếm / Cập nhật",
  "receipt.update_invoices": "Cập nhật ảnh hóa đơn",
  "receipt.approve": "Duyệt đặt hàng",
  "receipt.post": "Duyệt nhập kho",
  "receipt.cancel": "Hủy phiếu",
};

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  const isDev = isSuperuser(profile?.role);
  const { id } = await params;
  const supabase = await createClient();

  const { data: receipt } = await supabase
    .from("receipts")
    .select("*, supplier:suppliers(name), creator:profiles!receipts_created_by_fkey(name), approver:profiles!receipts_approved_by_fkey(name)")
    .eq("id", id)
    .single();
  if (!receipt) notFound();

  // ---- Vật tư nhập ----
  const { data: items } = await supabase
    .from("receipt_items")
    .select("id, quantity, unit_cost, batch_no, expiry_date, variants(attributes, unit, products(name))")
    .eq("receipt_id", id)
    .order("created_at", { ascending: true });

  const total = (items ?? []).reduce((n, it) => n + it.quantity * (it.unit_cost ?? 0), 0);
  const totalQuantity = (items ?? []).reduce((n, it) => n + it.quantity, 0);

  // ---- Các phiếu yêu cầu được auto cấp phát khi ghi nhận (FIFO) ----
  const linkedIds = receipt.linked_requisition_ids ?? [];
  let linkedReqs: {
    id: string;
    code: string;
    purpose: string | null;
    status: string;
    requester: { name: string | null } | null;
  }[] = [];
  if (linkedIds.length > 0) {
    const { data } = await supabase
      .from("requisitions")
      .select("id, code, purpose, status, requester:profiles!requisitions_requester_id_fkey(name)")
      .in("id", linkedIds)
      .order("created_at", { ascending: true });
    linkedReqs = (data ?? []) as typeof linkedReqs;
  }

  // ---- Tiến trình (audit: manager-only, khớp RLS phiếu nhập) ----
  const { data: audit } = await supabase
    .from("audit_logs")
    .select("id, action, created_at, actor:profiles!audit_logs_actor_id_fkey(name)")
    .eq("entity_type", "receipt")
    .eq("entity_id", id)
    .order("created_at", { ascending: true });
  const events = (audit ?? []).map((a) => ({
    label: AUDIT_LABELS[a.action] ?? a.action,
    at: a.created_at,
    by: a.actor?.name,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-lg font-semibold">{receipt.code}</h2>
            <Badge variant={statusBadgeVariant(receipt.status)}>
              {RECEIPT_STATUS[receipt.status] ?? receipt.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {receipt.supplier?.name ?? "Không có nhà cung cấp"} · Người tạo: {receipt.creator?.name ?? "—"}
            {receipt.approver?.name ? ` · Người duyệt: ${receipt.approver.name}` : ""} ·{" "}
            {formatDate(receipt.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReceiptActions id={receipt.id} status={receipt.status} />
          <DevDocTools kind="receipt" id={receipt.id} code={receipt.code} docName="phiếu nhập" canReopen={receipt.status === "posted"} isDev={isDev} compact />
          <Link
            href={`/api/receipts/${receipt.id}/pdf`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            target="_blank"
          >
            In PDF
          </Link>
        </div>
      </div>

      {receipt.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ghi chú</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{receipt.notes}</CardContent>
        </Card>
      )}

      {/* Hóa đơn & chứng từ mua hàng (hỗ trợ bổ sung ảnh trước và sau khi duyệt nhập kho) */}
      <ReceiptInvoices
        receiptId={receipt.id}
        receiptCode={receipt.code}
        invoiceImages={receipt.invoice_images ?? []}
        status={receipt.status}
        isManager={isPrivileged(profile?.role)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vật tư nhập</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên vật tư</TableHead>
                  <TableHead>Đơn vị tính</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead className="text-right">Thành tiền</TableHead>
                  <TableHead>Lô</TableHead>
                  <TableHead>Hạn sử dụng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Chưa có vật tư nào.
                    </TableCell>
                  </TableRow>
                )}
                {(items ?? []).map((it) => {
                  const v = it.variants as {
                    attributes?: unknown;
                    unit?: string | null;
                    products?: { name?: string | null } | null;
                  } | null;
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        <span className="font-medium">{v?.products?.name ?? "Vật tư"}</span>
                        <span className="ml-1 text-muted-foreground">
                          {variantLabel(v?.attributes, v?.unit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{v?.unit ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {it.unit_cost != null ? formatVnd(it.unit_cost) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatVnd(it.quantity * (it.unit_cost ?? 0))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{it.batch_no ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {it.expiry_date ? formatDate(it.expiry_date) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(items ?? []).length > 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="font-medium">Tổng cộng</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{totalQuantity}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-medium tabular-nums">{formatVnd(total)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {receipt.status === "posted" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phiếu yêu cầu được cấp phát</CardTitle>
          </CardHeader>
          <CardContent>
            {linkedReqs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Không có phiếu yêu cầu nào được cấp phát tự động (không có yêu cầu đang chờ hoặc tồn chưa đủ).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã phiếu</TableHead>
                      <TableHead>Người yêu cầu</TableHead>
                      <TableHead>Mục đích</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedReqs.map((rq) => (
                      <TableRow key={rq.id}>
                        <TableCell>
                          <Link href={`/requisitions/${rq.id}`} className="font-mono text-sm text-primary hover:underline">
                            {rq.code}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{rq.requester?.name ?? "—"}</TableCell>
                        <TableCell className="max-w-[320px] text-muted-foreground">{rq.purpose ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(rq.status)}>
                            {REQUISITION_STATUS[rq.status] ?? rq.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiến trình</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {events.map((t, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-center gap-3">
                    <span className="size-2 shrink-0 rounded-full bg-primary" />
                    <span className="w-40 font-medium">{t.label}</span>
                    <span className="text-muted-foreground">{t.at ? formatDate(t.at) : "—"}</span>
                    {t.by ? <span className="text-muted-foreground">· {t.by}</span> : null}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
