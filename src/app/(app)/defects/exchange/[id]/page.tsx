import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ClipboardList, Milestone, Package, PackageX, User } from "lucide-react";
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
import { ExchangeDetailActions } from "@/features/exchanges/components/exchange-detail-actions";
import { requireManager } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { ZoomableImage } from "@/components/image-lightbox";
import { EXCHANGE_STATUS, statusBadgeVariant, variantLabel } from "@/lib/labels";
import { isPrivileged } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface TimelineItem {
  label: string;
  at: string | null;
  by: string | null;
}

export default async function ExchangeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireManager();
  const supabase = await createClient();

  const { data: note } = await supabase
    .from("exchange_notes")
    .select(
      "*, creator:profiles!exchange_notes_created_by_fkey(name), approver:profiles!exchange_notes_approved_by_fkey(name), issuer:profiles!exchange_notes_issued_by_fkey(name), receiver:profiles!exchange_notes_received_by_fkey(name), rejecter:profiles!exchange_notes_rejected_by_fkey(name), defect:defect_notes!exchange_notes_linked_defect_id_fkey(id, code, reporter:profiles!defect_notes_reported_by_fkey(name))",
    )
    .eq("id", id)
    .single();
  if (!note) notFound();

  const { data: noteItems } = await supabase
    .from("exchange_note_items")
    .select("id, variant_id, quantity, variants(attributes, unit, products(name))")
    .eq("exchange_note_id", id);

  // Chứng cứ HONG liên kết (để manager đối chiếu trước khi duyệt/cấp).
  const { data: defectItems } = note?.defect?.id
    ? await supabase
        .from("defect_note_items")
        .select("id, quantity, damage_detail, images, variants(products(name))")
        .eq("defect_note_id", note.defect.id)
    : { data: [] };

  const timeline: TimelineItem[] = [
    { label: "Tạo phiếu", at: note.created_at, by: (note.creator as { name?: string | null } | null)?.name ?? null },
    { label: "Duyệt", at: note.approved_at, by: (note.approver as { name?: string | null } | null)?.name ?? null },
    { label: "Cấp phát", at: note.issued_at, by: (note.issuer as { name?: string | null } | null)?.name ?? null },
    { label: "Xác nhận nhận", at: note.received_at, by: (note.receiver as { name?: string | null } | null)?.name ?? null },
    { label: "Từ chối", at: note.rejected_at, by: (note.rejecter as { name?: string | null } | null)?.name ?? null },
  ].filter((t) => t.at);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-xl font-semibold tracking-tight">{note.code}</h2>
            <Badge variant={statusBadgeVariant(note.status)}>
              {EXCHANGE_STATUS[note.status] ?? note.status}
            </Badge>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ClipboardList className="size-4" aria-hidden />
              Phiếu Đổi Mới
            </span>
            <Link
              href="#hong"
              className="inline-flex items-center gap-1.5 font-mono text-primary hover:underline"
            >
              {note.defect?.code ?? "—"}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4" aria-hidden />
              {note.defect?.reporter?.name ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4" aria-hidden />
              {formatDate(note.created_at)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExchangeDetailActions exchangeId={note.id} status={note.status} isManager={isPrivileged(profile.role)} />
          <Button variant="outline" size="sm" asChild>
            <Link href="/defects">← Vật tư hỏng</Link>
          </Button>
        </div>
      </div>

      {note.rejection_reason && (
        <Card className="border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20">
          <CardContent className="flex items-start gap-2.5 py-3.5">
            <p className="whitespace-pre-wrap text-sm text-red-700 dark:text-red-300">
              <span className="font-semibold">Lý do từ chối: </span>
              {note.rejection_reason}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Package className="size-4" aria-hidden />
            </span>
            <CardTitle className="text-base">Vật tư cấp mới</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên vật tư</TableHead>
                <TableHead>Quy cách</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(noteItems ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Không có vật tư.
                  </TableCell>
                </TableRow>
              )}
              {(noteItems ?? []).map((i) => {
                const variants = i.variants as {
                  attributes?: unknown;
                  unit?: string | null;
                  products?: { name?: string | null } | null;
                } | null;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{variants?.products?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {variantLabel(variants?.attributes, variants?.unit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card id="hong">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
              <PackageX className="size-4" aria-hidden />
            </span>
            <CardTitle className="text-base">
              Vật tư hỏng liên quan{" "}
              <span className="ml-1 font-mono text-sm font-normal text-muted-foreground">
                · {note.defect?.code ?? "—"}
              </span>
            </CardTitle>
          </div>
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
              {(defectItems ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Không có dòng vật tư hỏng.
                  </TableCell>
                </TableRow>
              )}
              {(defectItems ?? []).map((it) => {
                const variants = it.variants as { products?: { name?: string | null } | null } | null;
                return (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{variants?.products?.name ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{it.quantity}</TableCell>
                    <TableCell className="max-w-[320px] text-muted-foreground">{it.damage_detail ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(it.images ?? []).map((url) => (
                          <ZoomableImage
                            key={url}
                            src={url}
                            images={it.images ?? []}
                            alt={`${variants?.products?.name ?? "Vật tư"} — ảnh minh chứng hỏng`}
                            title={variants?.products?.name ?? "Minh chứng hỏng"}
                            className="size-12 rounded-md border object-cover"
                          />
                        ))}
                        {(it.images ?? []).length === 0 ? <span className="text-muted-foreground">—</span> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                <Milestone className="size-4" aria-hidden />
              </span>
              <CardTitle className="text-base">Tiến trình</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ol>
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="mt-[5px] size-2.5 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1 pb-4">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-sm">
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {t.at ? formatDateTime(t.at) : "—"}
                      </span>
                      {t.by ? <span className="text-xs text-muted-foreground">· {t.by}</span> : null}
                    </div>
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
