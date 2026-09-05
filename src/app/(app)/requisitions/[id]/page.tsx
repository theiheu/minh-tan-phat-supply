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
import { RequisitionActions } from "@/features/requisitions/components/requisition-actions";
import { getCurrentProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { REQUISITION_STATUS, REQUISITION_TYPE, statusBadgeClass, variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("requisitions")
    .select(
      "*, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name), approver:profiles!requisitions_approved_by_fkey(name), fulfiller:profiles!requisitions_fulfilled_by_fkey(name), receiver:profiles!requisitions_received_by_fkey(name)",
    )
    .eq("id", id)
    .single();
  if (!req) notFound();

  const { data: items } = await supabase
    .from("requisition_items")
    .select("id, quantity, variants(attributes, unit, price, products(name))")
    .eq("requisition_id", id);

  const timeline = [
    { label: "Tạo phiếu", at: req.created_at, by: req.requester?.name },
    { label: "Duyệt", at: req.approved_at, by: req.approver?.name },
    { label: "Cấp phát", at: req.fulfilled_at, by: req.fulfiller?.name },
    { label: "Nhận hàng", at: req.received_at, by: req.receiver?.name },
  ].filter((t) => t.at);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-lg font-semibold">{req.code}</h2>
            <Badge variant="outline" className={statusBadgeClass(req.status)}>
              {REQUISITION_STATUS[req.status] ?? req.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {REQUISITION_TYPE[req.requisition_type] ?? req.requisition_type} · {req.zone?.name ?? "—"} ·{" "}
            {req.requester?.name ?? "—"}
          </p>
        </div>
        {profile && (
          <RequisitionActions
            requisitionId={req.id}
            status={req.status}
            requesterId={req.requester_id}
            currentUserId={profile.id}
            role={profile.role}
          />
        )}
      </div>

      {req.rejection_reason && (
        <Card className="border-red-200">
          <CardContent className="py-3 text-sm text-red-700">Lý do từ chối: {req.rejection_reason}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mục đích</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">{req.purpose}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vật tư</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên vật tư</TableHead>
                <TableHead>Biến thể</TableHead>
                <TableHead>Đơn vị</TableHead>
                <TableHead>Số lượng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.variants?.products?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{variantLabel(i.variants?.attributes, i.variants?.unit)}</TableCell>
                  <TableCell>{i.variants?.unit ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{i.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiến trình</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {timeline.map((t) => (
                <li key={t.label} className="flex items-center gap-3 text-sm">
                  <span className="size-2 rounded-full bg-primary" />
                  <span className="w-24 font-medium">{t.label}</span>
                  <span className="text-muted-foreground">{formatDate(t.at)}</span>
                  {t.by ? <span className="text-muted-foreground">· {t.by}</span> : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
