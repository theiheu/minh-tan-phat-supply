import Image from "next/image";
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
import { RequisitionActions } from "@/features/requisitions/components/requisition-actions";
import { ReturnItems } from "@/features/requisitions/components/return-items";
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
    .select("id, variant_id, quantity, variants(attributes, unit, price, images, products(name, images))")
    .eq("requisition_id", id);

  // ---- Lịch sử đầy đủ ----
  // Manager đọc được audit_logs (RLS) → timeline đầy đủ cả các bước bị từ chối/hủy/trả lại.
  // Requester chỉ thấy các mốc cơ bản lấy từ chính phiếu.
  interface TimelineEvent {
    label: string;
    at: string | null;
    by?: string | null;
    note?: string | null;
  }

  let events: TimelineEvent[] = [];
  const isManager = profile?.role === "manager";
  if (isManager) {
    const AUDIT_LABELS: Record<string, string> = {
      "requisition.create": "Tạo phiếu",
      "requisition.submit": "Gửi yêu cầu",
      "requisition.approve": "Duyệt phiếu",
      "requisition.reject": "Từ chối",
      "requisition.cancel": "Hủy phiếu",
      "requisition.fulfill": "Cấp phát",
      "requisition.receive": "Xác nhận nhận",
      "requisition.return": "Trả lại vật tư",
    };
    const { data: audit } = await supabase
      .from("audit_logs")
      .select("id, action, created_at, actor:profiles!audit_logs_actor_id_fkey(name)")
      .eq("entity_type", "requisition")
      .eq("entity_id", req.id)
      .order("created_at", { ascending: true });
    events = (audit ?? []).map((a) => ({
      label: AUDIT_LABELS[a.action] ?? a.action,
      at: a.created_at,
      by: a.actor?.name,
      note: a.action === "requisition.reject" ? req.rejection_reason : null,
    }));
  } else {
    events = [
      { label: "Tạo phiếu", at: req.created_at, by: req.requester?.name },
      { label: "Duyệt", at: req.approved_at, by: req.approver?.name },
      { label: "Cấp phát", at: req.fulfilled_at, by: req.fulfiller?.name },
      { label: "Nhận hàng", at: req.received_at, by: req.receiver?.name },
    ].filter((t) => t.at);
  }

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
        <div className="flex items-center gap-2">
          {profile && (
            <RequisitionActions
              requisitionId={req.id}
              status={req.status}
              requesterId={req.requester_id}
              currentUserId={profile.id}
              role={profile.role}
            />
          )}
          <Link
            href={`/api/requisitions/${req.id}/pdf`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            target="_blank"
          >
            In PDF
          </Link>
        </div>
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
              {(items ?? []).map((i) => {
                const itemImage = i.variants?.images?.[0] ?? i.variants?.products?.images?.[0];
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {itemImage ? (
                          <Image
                            src={itemImage}
                            alt=""
                            width={40}
                            height={40}
                            className="size-10 shrink-0 rounded-md border object-cover"
                          />
                        ) : null}
                        <span className="font-medium">{i.variants?.products?.name ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{variantLabel(i.variants?.attributes, i.variants?.unit)}</TableCell>
                    <TableCell>{i.variants?.unit ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{i.quantity}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {profile &&
        (req.status === "issued" || req.status === "received") &&
        (profile.role === "manager" || profile.id === req.requester_id) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trả lại vật tư không dùng hết</CardTitle>
            </CardHeader>
            <CardContent>
              <ReturnItems
                requisitionId={req.id}
                items={(items ?? []).map((i) => ({
                  id: i.id,
                  variantId: i.variant_id,
                  label: `${i.variants?.products?.name ?? "Vật tư"} — ${variantLabel(i.variants?.attributes, i.variants?.unit)}`,
                  quantity: i.quantity,
                }))}
              />
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
                    <span className="w-28 font-medium">{t.label}</span>
                    <span className="text-muted-foreground">{t.at ? formatDate(t.at) : "—"}</span>
                    {t.by ? <span className="text-muted-foreground">· {t.by}</span> : null}
                  </div>
                  {t.note ? <p className="mt-1 pl-7 text-xs text-red-600">Lý do: {t.note}</p> : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
