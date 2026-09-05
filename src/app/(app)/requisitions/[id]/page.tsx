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
import { MaterialItemsView, type MaterialItemView } from "@/features/requisitions/components/material-items-view";
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
    .select(
      "id, variant_id, quantity, variants(attributes, unit, price, images, products(name, images, description))",
    )
    .eq("requisition_id", id);

  // ---- Tồn kho hiện tại từng vật tư (để quản kho đối chiếu khi cấp phát) ----
  const variantIds = [...new Set((items ?? []).map((i) => i.variant_id).filter((v): v is string => Boolean(v)))];
  const stockByVariant = new Map<string, number>();
  if (variantIds.length > 0) {
    const { data: stockRows } = await supabase
      .from("variant_stock")
      .select("variant_id, quantity")
      .in("variant_id", variantIds);
    for (const s of stockRows ?? []) {
      if (s.variant_id != null && s.quantity != null) stockByVariant.set(s.variant_id, s.quantity);
    }
  }

  // ---- Lịch sử trả lại vật tư (mọi sự kiện của phiếu) ----
  const { data: returnEvents } = await supabase
    .from("requisition_returns")
    .select(
      "id, returned_by, created_at, returnedBy:profiles!requisition_returns_returned_by_fkey(name), items:requisition_return_items(variant_id, quantity, variants(attributes, unit, products(name)))",
    )
    .eq("requisition_id", id)
    .order("created_at", { ascending: false });

  // Tổng đã trả theo variant (qua mọi sự kiện) — dùng cho form trả và dòng vật tư.
  const returnedByVariant = new Map<string, number>();
  for (const ev of returnEvents ?? []) {
    for (const it of (ev as { items?: { variant_id: string; quantity: number }[] }).items ?? []) {
      returnedByVariant.set(it.variant_id, (returnedByVariant.get(it.variant_id) ?? 0) + it.quantity);
    }
  }

  const materialItems: MaterialItemView[] = (items ?? []).map((i) => ({
    id: i.id,
    variantId: i.variant_id,
    productName: (i.variants as { products?: { name?: string | null } | null } | null)?.products?.name ?? null,
    description: (i.variants as { products?: { description?: string | null } | null } | null)?.products?.description ?? null,
    attributes: (i.variants as { attributes?: unknown } | null)?.attributes ?? null,
    unit: (i.variants as { unit?: string | null } | null)?.unit ?? null,
    quantity: i.quantity,
    returned: returnedByVariant.get(i.variant_id) ?? 0,
    images: [
      ...((i.variants as { images?: string[] | null } | null)?.images ?? []),
      ...((i.variants as { products?: { images?: string[] | null } | null } | null)?.products?.images ?? []),
    ],
    stock: i.variant_id ? (stockByVariant.get(i.variant_id) ?? null) : null,
  }));

  // ---- Chứng cứ vật tư hỏng (phiếu Đổi mới) ----
  let defectEvidence: {
    code: string;
    items: {
      id: string;
      productName: string | null;
      quantity: number;
      damageDetail: string | null;
      images: string[];
    }[];
  } | null = null;
  if (req.requisition_type === "replacement" && req.linked_defect_id) {
    const [{ data: dnote }, { data: ditems }] = await Promise.all([
      supabase.from("defect_notes").select("code").eq("id", req.linked_defect_id).single(),
      supabase
        .from("defect_note_items")
        .select("id, quantity, damage_detail, images, variants(products(name))")
        .eq("defect_note_id", req.linked_defect_id),
    ]);
    if (dnote) {
      defectEvidence = {
        code: dnote.code,
        items: (ditems ?? []).map((it) => ({
          id: it.id,
          productName: (it.variants as { products?: { name: string | null } | null } | null)?.products?.name ?? null,
          quantity: it.quantity,
          damageDetail: it.damage_detail,
          images: it.images ?? [],
        })),
      };
    }
  }

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
          <MaterialItemsView items={materialItems} />
        </CardContent>
      </Card>

      {defectEvidence && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Vật tư hỏng liên quan · <span className="font-mono">{defectEvidence.code}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên vật tư</TableHead>
                  <TableHead>Số lượng</TableHead>
                  <TableHead>Chi tiết hỏng</TableHead>
                  <TableHead>Ảnh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defectEvidence.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.productName ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{it.quantity}</TableCell>
                    <TableCell className="max-w-[320px] text-muted-foreground">{it.damageDetail ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {it.images.map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={url} src={url} alt="" className="size-12 rounded-md border object-cover" />
                        ))}
                        {it.images.length === 0 ? <span className="text-muted-foreground">—</span> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                  returned: returnedByVariant.get(i.variant_id) ?? 0,
                }))}
              />
            </CardContent>
          </Card>
        )}

      {returnEvents && returnEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lịch sử trả lại</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {returnEvents.map((ev) => {
              const evItems =
                (ev as {
                  items?: {
                    variant_id: string;
                    quantity: number;
                    variants?: { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
                  }[];
                }).items ?? [];
              return (
                <div key={ev.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{(ev as { returnedBy?: { name?: string | null } | null }).returnedBy?.name ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(ev.created_at)}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {evItems.map((it, idx) => (
                      <div key={idx} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">
                          {it.variants?.products?.name ?? "Vật tư"}
                          <span className="text-muted-foreground">
                            {" "}· {variantLabel(it.variants?.attributes, it.variants?.unit)}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">× {it.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
