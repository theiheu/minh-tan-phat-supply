import Link from "next/link";
import { notFound } from "next/navigation";
import { Milestone, QrCode } from "lucide-react";
import { cn } from "cn";
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
import { formatDate, formatDateTime, formatVnd } from "@/lib/format";
import { RECEIPT_STATUS, REQUISITION_STATUS, statusBadgeVariant, variantLabel } from "@/lib/labels";
import { isPrivileged, isSuperuser } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { ReceiptInvoices } from "@/features/receipts/components/receipt-invoices";

export const dynamic = "force-dynamic";

/** Màu chấm trên timeline Tiến trình — khớp ý nghĩa trạng thái của phiếu. */
const EVENT_DOT_CLASS: Record<string, string> = {
  create: "bg-gray-400 dark:bg-gray-500",
  update: "bg-amber-400 dark:bg-amber-500",
  update_invoices: "bg-indigo-400 dark:bg-indigo-500",
  approve: "bg-sky-500",
  post: "bg-emerald-500",
  cancel: "bg-red-500",
  other: "bg-gray-400 dark:bg-gray-500",
};

/** Màu chữ nhãn mốc — tô theo trạng thái tương ứng. */
const EVENT_LABEL_CLASS: Record<string, string> = {
  create: "text-gray-700 dark:text-gray-300",
  update: "text-amber-700 dark:text-amber-300",
  update_invoices: "text-indigo-700 dark:text-indigo-300",
  approve: "text-sky-700 dark:text-sky-300",
  post: "text-emerald-700 dark:text-emerald-300",
  cancel: "text-red-700 dark:text-red-300",
  other: "text-gray-700 dark:text-gray-300",
};

const AUDIT_EVENT_KEY: Record<string, string> = {
  "receipt.create": "create",
  "receipt.update": "update",
  "receipt.update_invoices": "update_invoices",
  "receipt.approve": "approve",
  "receipt.post": "post",
  "receipt.cancel": "cancel",
};

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
    key: AUDIT_EVENT_KEY[a.action] ?? "other",
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
            href={`/qr/receipt/${receipt.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            target="_blank"
          >
            <QrCode className="size-4" aria-hidden />
            In mã QR
          </Link>
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
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                <Milestone className="size-4" aria-hidden />
              </span>
              <CardTitle className="text-base">Tiến trình</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ol>
              {events.map((t, i) => {
                const isLast = i === events.length - 1;
                return (
                  <li key={i} className="flex gap-3">
                    {/* Cột mốc: chấm màu + đường nối dọc */}
                    <div aria-hidden className="flex flex-col items-center self-stretch">
                      <span
                        className={cn(
                          "mt-[5px] size-2.5 shrink-0 rounded-full",
                          EVENT_DOT_CLASS[t.key] ?? EVENT_DOT_CLASS.other,
                        )}
                      />
                      {!isLast ? <span className="w-px flex-1 rounded-full bg-border" /> : null}
                    </div>
                    <div className={cn("min-w-0 flex-1", isLast ? "pb-0.5" : "pb-6")}>
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-sm">
                        <span
                          className={cn(
                            "font-semibold",
                            EVENT_LABEL_CLASS[t.key] ?? EVENT_LABEL_CLASS.other,
                          )}
                        >
                          {t.label}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {t.at ? formatDateTime(t.at) : "—"}
                        </span>
                        {t.by ? <span className="text-xs text-muted-foreground">· {t.by}</span> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
