import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  MapPin,
  Milestone,
  NotebookPen,
  Package,
  PackageX,
  Printer,
  QrCode,
  Undo2,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { DevDocTools } from "@/features/dev-tools/dev-doc-tools";
import { getCurrentProfile } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { REQUISITION_STATUS, REQUISITION_TYPE, statusBadgeVariant, variantLabel } from "@/lib/labels";
import { isPrivileged, isSuperuser } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { ZoomableImage } from "@/components/image-lightbox";

export const dynamic = "force-dynamic";

// ---- Kiểu hiển thị (trình bày) ----

/** Màu chip icon đầu mỗi thẻ — nền nhạt + chữ đậm (giống chip StatCard). */
const CHIP_CLASS: Record<string, string> = {
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

/** Màu chấm trên timeline Tiến trình — khớp ý nghĩa trạng thái của phiếu. */
const EVENT_DOT_CLASS: Record<string, string> = {
  create: "bg-gray-400 dark:bg-gray-500",
  "requisition.create": "bg-gray-400 dark:bg-gray-500",
  submit: "bg-amber-400 dark:bg-amber-500",
  "requisition.submit": "bg-amber-400 dark:bg-amber-500",
  approve: "bg-sky-500",
  "requisition.approve": "bg-sky-500",
  fulfill: "bg-orange-500",
  "requisition.fulfill": "bg-orange-500",
  receive: "bg-emerald-500",
  "requisition.receive": "bg-emerald-500",
  reject: "bg-red-500",
  "requisition.reject": "bg-red-500",
  cancel: "bg-gray-400 dark:bg-gray-500",
  "requisition.cancel": "bg-gray-400 dark:bg-gray-500",
  return: "bg-violet-500",
  "requisition.return": "bg-violet-500",
  other: "bg-gray-400 dark:bg-gray-500",
};

/** Màu chữ nhãn mốc — tô theo trạng thái tương ứng. */
const EVENT_LABEL_CLASS: Record<string, string> = {
  create: "text-gray-700 dark:text-gray-300",
  "requisition.create": "text-gray-700 dark:text-gray-300",
  submit: "text-amber-700 dark:text-amber-300",
  "requisition.submit": "text-amber-700 dark:text-amber-300",
  approve: "text-sky-700 dark:text-sky-300",
  "requisition.approve": "text-sky-700 dark:text-sky-300",
  fulfill: "text-orange-700 dark:text-orange-300",
  "requisition.fulfill": "text-orange-700 dark:text-orange-300",
  receive: "text-emerald-700 dark:text-emerald-300",
  "requisition.receive": "text-emerald-700 dark:text-emerald-300",
  reject: "text-red-700 dark:text-red-300",
  "requisition.reject": "text-red-700 dark:text-red-300",
  cancel: "text-gray-700 dark:text-gray-300",
  "requisition.cancel": "text-gray-700 dark:text-gray-300",
  return: "text-violet-700 dark:text-violet-300",
  "requisition.return": "text-violet-700 dark:text-violet-300",
  other: "text-gray-700 dark:text-gray-300",
};

/** Audit action → khóa màu tương ứng (để timeline màu đồng nhất 2 chế độ xem). */
const AUDIT_EVENT_KEY: Record<string, string> = {
  "requisition.create": "create",
  "requisition.submit": "submit",
  "requisition.approve": "approve",
  "requisition.reject": "reject",
  "requisition.cancel": "cancel",
  "requisition.fulfill": "fulfill",
  "requisition.receive": "receive",
  "requisition.return": "return",
};

/** Tiêu đề thẻ nội dung: chip icon màu + tiêu đề (right có thể là số đếm…). */
function SectionHeader({
  icon: Icon,
  tone,
  title,
  right,
}: {
  icon: LucideIcon;
  tone: string;
  title: ReactNode;
  right?: ReactNode;
}) {
  return (
    <CardHeader className="pb-3 border-b border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              CHIP_CLASS[tone] ?? CHIP_CLASS.orange,
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {right}
      </div>
    </CardHeader>
  );
}

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
      unit: string | null;
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
        .select("id, quantity, damage_detail, images, variants(attributes, unit, products(name))")
        .eq("defect_note_id", req.linked_defect_id),
    ]);
    if (dnote) {
      defectEvidence = {
        code: dnote.code,
        items: (ditems ?? []).map((it) => {
          const v = it.variants as { unit?: string | null; products?: { name: string | null } | null } | null;
          return {
            id: it.id,
            productName: v?.products?.name ?? null,
            unit: v?.unit ?? null,
            quantity: it.quantity,
            damageDetail: it.damage_detail,
            images: it.images ?? [],
          };
        }),
      };
    }
  }

  // ---- Lịch sử đầy đủ ----
  // Manager đọc được audit_logs (RLS) → timeline đầy đủ cả các bước bị từ chối/hủy/trả lại.
  // Requester chỉ thấy các mốc cơ bản lấy từ chính phiếu.
  interface TimelineEvent {
    /** Khóa màu trạng thái của mốc (create/submit/approve/…). */
    key: string;
    label: string;
    at: string | null;
    by?: string | null;
    /** Ghi chú cảnh báo (đỏ) — hiện dùng cho lý do từ chối. */
    note?: string | null;
    /** Chi tiết thường (xám) — ví dụ danh sách món đã trả lại. */
    detail?: string | null;
  }

  let events: TimelineEvent[] = [];
  const isManager = isPrivileged(profile?.role);
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
    events = (audit ?? [])
      .filter((a) => a.action !== "requisition.return") // tránh trùng — mốc trả lấy từ requisition_returns bên dưới
      .map((a) => ({
        key: AUDIT_EVENT_KEY[a.action] ?? "other",
        label: AUDIT_LABELS[a.action] ?? a.action,
        at: a.created_at,
        by: a.actor?.name,
        note: a.action === "requisition.reject" ? req.rejection_reason : null,
      }));
  } else {
    events = [
      { key: "create", label: "Tạo phiếu", at: req.created_at, by: req.requester?.name },
      { key: "approve", label: "Duyệt", at: req.approved_at, by: req.approver?.name },
      { key: "fulfill", label: "Cấp phát", at: req.fulfilled_at, by: req.fulfiller?.name },
      { key: "receive", label: "Nhận hàng", at: req.received_at, by: req.receiver?.name },
    ].filter((t) => t.at);
  }

  // Mốc trả lại vật tư — gộp từ lịch sử trả (quản kho & người yêu cầu đều thấy,
  // kèm ngày giờ + ai trả + chi tiết món). Bên trên đã lọc bỏ audit.return để khỏi trùng.
  const returnMilestones: TimelineEvent[] = (returnEvents ?? []).map((ev) => {
    const typed = ev as {
      created_at: string;
      returnedBy?: { name?: string | null } | null;
      items?: {
        quantity: number;
        variants?: { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null;
      }[];
    };
    const lines = (typed.items ?? []).map((it) => {
      const name = it.variants?.products?.name ?? "Vật tư";
      const label = variantLabel(it.variants?.attributes, it.variants?.unit);
      return label && label !== "—" ? `${name} — ${label} × ${it.quantity}` : `${name} × ${it.quantity}`;
    });
    return {
      key: "return",
      label: "Trả lại vật tư",
      at: typed.created_at,
      by: typed.returnedBy?.name,
      detail: lines.length > 0 ? lines.join("\n") : null,
    };
  });
  events = [...events, ...returnMilestones].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));

  // Được trả lại hay không: phiếu đã cấp phát/nhận, đúng vai trò, và còn món chưa trả hết.
  const canReturn =
    !!profile &&
    (req.status === "issued" || req.status === "received") &&
    (isPrivileged(profile.role) || profile.id === req.requester_id) &&
    (items ?? []).some((i) => (i.quantity ?? 0) - (returnedByVariant.get(i.variant_id ?? "") ?? 0) > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-xl font-semibold tracking-tight">{req.code}</h2>
            <Badge variant={statusBadgeVariant(req.status)}>
              {REQUISITION_STATUS[req.status] ?? req.status}
            </Badge>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ClipboardList className="size-4" aria-hidden />
              {REQUISITION_TYPE[req.requisition_type] ?? req.requisition_type}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {req.zone?.name ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4" aria-hidden />
              {req.requester?.name ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4" aria-hidden />
              {formatDate(req.created_at)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile && (
            <DevDocTools
              kind="requisition"
              id={req.id}
              code={req.code}
              docName="phiếu yêu cầu"
              canReopen={req.status === "issued" || req.status === "received"}
              isDev={isSuperuser(profile.role)}
              compact
            />
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/qr/requisition/${req.id}`} target="_blank">
              <QrCode aria-hidden />
              In mã QR
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/api/requisitions/${req.id}/pdf`} target="_blank">
              <Printer aria-hidden />
              In PDF
            </Link>
          </Button>
        </div>
      </div>

      {req.rejection_reason && (
        <Card className="border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20">
          <CardContent className="flex items-start gap-2.5 py-3.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
            <p className="whitespace-pre-wrap text-sm text-red-700 dark:text-red-300">
              <span className="font-semibold">Lý do từ chối: </span>
              {req.rejection_reason}
            </p>
          </CardContent>
        </Card>
      )}

      {isManager && (req.status === "pending" || req.status === "approved") && materialItems.some((m) => (m.stock ?? 0) < m.quantity) && (
        <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Tồn kho không đủ cấp phát:</span> Có vật tư trong phiếu đang hết hoặc thiếu tồn kho. Quản kho có thể lập phiếu đặt hàng để nhập bổ sung.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href={`/receipts/new?requisition_id=${req.id}`}>
                Tạo phiếu đặt hàng nhập kho
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <SectionHeader icon={Package} tone="emerald" title="Vật tư" />
        <CardContent>
          <MaterialItemsView items={materialItems} />

          {canReturn && (
            <div className="mt-5 border-t pt-5">
              <div className="mb-3 flex items-center gap-2 pb-2 border-b border-border/60">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <Undo2 className="size-4" aria-hidden />
                </span>
                <h3 className="text-sm font-semibold">Trả lại vật tư không dùng hết</h3>
              </div>
              <ReturnItems
                requisitionId={req.id}
                items={(items ?? []).map((i) => ({
                  id: i.id,
                  variantId: i.variant_id,
                  label: `${i.variants?.products?.name ?? "Vật tư"} — ${variantLabel(i.variants?.attributes, i.variants?.unit)}`,
                  quantity: i.quantity,
                  returned: returnedByVariant.get(i.variant_id ?? "") ?? 0,
                }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <SectionHeader icon={NotebookPen} tone="orange" title="Mục đích" />
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{req.purpose}</p>
        </CardContent>
      </Card>

      {defectEvidence && (
        <Card>
          <SectionHeader
            icon={PackageX}
            tone="red"
            title={
              <>
                Vật tư hỏng liên quan{" "}
                <span className="ml-1 font-mono text-sm font-normal text-muted-foreground">· {defectEvidence.code}</span>
              </>
            }
          />
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên vật tư</TableHead>
                  <TableHead>Đơn vị tính</TableHead>
                  <TableHead>Số lượng</TableHead>
                  <TableHead>Chi tiết hỏng</TableHead>
                  <TableHead>Ảnh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defectEvidence.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.productName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{it.unit ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{it.quantity}</TableCell>
                    <TableCell className="max-w-[320px] text-muted-foreground">{it.damageDetail ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {it.images.map((url) => (
                          <ZoomableImage
                            key={url}
                            src={url}
                            images={it.images}
                            alt={`${it.productName ?? "Vật tư"} — ảnh minh chứng`}
                            title={it.productName ?? "Minh chứng hỏng"}
                            className="size-12 rounded-md border object-cover"
                          />
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

      {events.length > 0 && (
        <Card>
          <SectionHeader icon={Milestone} tone="sky" title="Tiến trình" />
          <CardContent>
            <ol>
              {events.map((t, i) => {
                const isLast = i === events.length - 1;
                const isFulfill =
                  t.key === "fulfill" ||
                  t.key === "requisition.fulfill" ||
                  t.label?.toLowerCase().includes("cấp phát");
                const dotClass = isFulfill
                  ? "bg-orange-500"
                  : (EVENT_DOT_CLASS[t.key] ?? EVENT_DOT_CLASS.other);
                const labelClass = isFulfill
                  ? "text-orange-700 dark:text-orange-300"
                  : (EVENT_LABEL_CLASS[t.key] ?? EVENT_LABEL_CLASS.other);
                return (
                  <li key={i} className="flex gap-3">
                    {/* Cột mốc: chấm màu + đường nối dọc */}
                    <div aria-hidden className="flex flex-col items-center self-stretch">
                      <span
                        className={cn(
                          "mt-[5px] size-2.5 shrink-0 rounded-full",
                          dotClass,
                        )}
                        style={isFulfill ? { backgroundColor: "#f97316" } : undefined}
                      />
                      {!isLast ? <span className="w-px flex-1 rounded-full bg-border" /> : null}
                    </div>
                    <div className={cn("min-w-0 flex-1", isLast ? "pb-0.5" : "pb-6")}>
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-sm">
                        <span
                          className={cn(
                            "font-semibold",
                            labelClass,
                          )}
                        >
                          {t.label}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {t.at ? formatDateTime(t.at) : "—"}
                        </span>
                        {t.by ? <span className="text-xs text-muted-foreground">· {t.by}</span> : null}
                      </div>
                      {t.detail ? (
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                          {t.detail}
                        </p>
                      ) : null}
                      {t.note ? (
                        <p className="mt-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                          Lý do: {t.note}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Nút thao tác theo trạng thái — đặt cuối trang, canh phải (giống thanh nút trong modal) */}
      {profile && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          <RequisitionActions
            requisitionId={req.id}
            status={req.status}
            requesterId={req.requester_id}
            currentUserId={profile.id}
            role={profile.role}
          />
        </div>
      )}
    </div>
  );
}
