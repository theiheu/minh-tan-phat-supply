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
import { IssueActions } from "@/features/issues/components/issue-actions";
import { DevDocTools } from "@/features/dev-tools/dev-doc-tools";
import { requireManager } from "@/lib/auth";
import { formatDate, formatVnd } from "@/lib/format";
import { ISSUE_DESTINATION, ISSUE_STATUS, statusBadgeVariant, variantLabel } from "@/lib/labels";
import { isSuperuser } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireManager();
  const isDev = isSuperuser(profile.role);
  const { id } = await params;
  const supabase = await createClient();

  const { data: issue } = await supabase
    .from("issues")
    .select(
      "*, customer:customers(name, phone, address), zone:zones(name), creator:profiles(name)",
    )
    .eq("id", id)
    .single();
  if (!issue) notFound();

  const isCustomer = issue.destination_type === "customer";

  // ---- Dòng vật tư xuất (giữ thứ tự nhập) ----
  const { data: items } = await supabase
    .from("issue_items")
    .select("id, quantity, unit_price, variants(attributes, unit, products(name))")
    .eq("issue_id", id)
    .order("created_at", { ascending: true });

  const totalQuantity = (items ?? []).reduce((n, it) => n + it.quantity, 0);
  const totalAmount = (items ?? []).reduce(
    (n, it) => n + it.quantity * (it.unit_price ?? 0),
    0,
  );

  const destinationName = isCustomer
    ? issue.customer?.name ?? "—"
    : issue.zone?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-lg font-semibold">{issue.code}</h2>
            <Badge variant={statusBadgeVariant(issue.status)}>
              {ISSUE_STATUS[issue.status] ?? issue.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {ISSUE_DESTINATION[issue.destination_type] ?? issue.destination_type} · {destinationName} ·{" "}
            {issue.creator?.name ?? "—"} · {formatDate(issue.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IssueActions id={issue.id} status={issue.status} />
          <DevDocTools kind="issue" id={issue.id} code={issue.code} docName="phiếu xuất" canReopen={issue.status === "posted"} isDev={isDev} compact />
          <Link
            href={`/api/issues/${issue.id}/pdf`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            target="_blank"
          >
            In phiếu
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin phiếu</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <span className="text-muted-foreground">Loại</span>
            <span className="sm:ml-2">
              {ISSUE_DESTINATION[issue.destination_type] ?? issue.destination_type}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <span className="text-muted-foreground">Bên nhận</span>
            <span className="sm:ml-2">{destinationName}</span>
          </div>
          {isCustomer && (
            <>
              <div className="flex items-baseline justify-between gap-2 sm:block">
                <span className="text-muted-foreground">Địa chỉ</span>
                <span className="sm:ml-2">{issue.customer?.address ?? "—"}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 sm:block">
                <span className="text-muted-foreground">Điện thoại</span>
                <span className="sm:ml-2">{issue.customer?.phone ?? "—"}</span>
              </div>
            </>
          )}
          {issue.vehicle_plate && (
            <div className="flex items-baseline justify-between gap-2 sm:block">
              <span className="text-muted-foreground">Biển số xe</span>
              <span className="sm:ml-2">{issue.vehicle_plate}</span>
            </div>
          )}
          {issue.driver_name && (
            <div className="flex items-baseline justify-between gap-2 sm:block">
              <span className="text-muted-foreground">Người vận chuyển</span>
              <span className="sm:ml-2">{issue.driver_name}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <span className="text-muted-foreground">Người lập</span>
            <span className="sm:ml-2">{issue.creator?.name ?? "—"}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <span className="text-muted-foreground">Ngày lập</span>
            <span className="sm:ml-2">{formatDate(issue.created_at)}</span>
          </div>
        </CardContent>
      </Card>

      {issue.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ghi chú</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{issue.notes}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vật tư xuất</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">STT</TableHead>
                  <TableHead>Tên hàng</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  {isCustomer && (
                    <>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isCustomer ? 5 : 3} className="text-center text-muted-foreground">
                      Chưa có vật tư nào.
                    </TableCell>
                  </TableRow>
                )}
                {(items ?? []).map((it, idx) => {
                  const v = it.variants as {
                    attributes?: unknown;
                    unit?: string | null;
                    products?: { name?: string | null } | null;
                  } | null;
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <span className="font-medium">{v?.products?.name ?? "Vật tư"}</span>
                        <span className="ml-1 text-muted-foreground">{variantLabel(v?.attributes, v?.unit)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                      {isCustomer && (
                        <>
                          <TableCell className="text-right tabular-nums">
                            {it.unit_price != null ? formatVnd(it.unit_price) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatVnd(it.quantity * (it.unit_price ?? 0))}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
                {(items ?? []).length > 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="font-medium">
                      Tổng cộng
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{totalQuantity}</TableCell>
                    {isCustomer && (
                      <>
                        <TableCell />
                        <TableCell className="text-right font-medium tabular-nums">{formatVnd(totalAmount)}</TableCell>
                      </>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
