import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatVnd } from "@/lib/format";
import { MOVEMENT_TYPE, variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { StockPdfButton } from "@/features/reports/components/stock-pdf-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    stock_page?: string;
    expiring_page?: string;
    movement_page?: string;
    audit_page?: string;
  }>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;
  const pageOf = (v: string | undefined) => Math.max(1, Number(v ?? "1") || 1);
  const stockPage = pageOf(sp.stock_page);
  const expiringPage = pageOf(sp.expiring_page);
  const movementPage = pageOf(sp.movement_page);
  const auditPage = pageOf(sp.audit_page);
  const rng = (p: number) => ((p - 1) * PAGE_SIZE);

  const [
    { data: variants },
    { data: profiles },
    { data: stock, count: stockCount },
    { data: expiring, count: expiringCount },
    { data: movements, count: movementCount },
    { data: audits, count: auditCount },
    { data: locations },
  ] = await Promise.all([
    supabase.from("variants").select("id, attributes, unit, price, products(name)"),
    supabase.from("profiles").select("id, name"),
    supabase
      .from("variant_stock")
      .select("variant_id, quantity, min_stock", { count: "exact" })
      .order("quantity", { ascending: true })
      .range(rng(stockPage), rng(stockPage) + PAGE_SIZE - 1),
    supabase
      .from("receipt_items")
      .select("variant_id, quantity, batch_no, expiry_date", { count: "exact" })
      .lte("expiry_date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      .order("expiry_date", { ascending: true })
      .range(rng(expiringPage), rng(expiringPage) + PAGE_SIZE - 1),
    supabase
      .from("stock_movements")
      .select("variant_id, movement_type, quantity, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(rng(movementPage), rng(movementPage) + PAGE_SIZE - 1),
    supabase
      .from("audit_logs")
      .select("actor_id, action, entity_type, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(rng(auditPage), rng(auditPage) + PAGE_SIZE - 1),
    supabase.from("stock_locations").select("id, code, name").order("code", { ascending: true }),
  ]);

  const stockTotalPages = Math.max(1, Math.ceil((stockCount ?? 0) / PAGE_SIZE));
  const expiringTotalPages = Math.max(1, Math.ceil((expiringCount ?? 0) / PAGE_SIZE));
  const movementTotalPages = Math.max(1, Math.ceil((movementCount ?? 0) / PAGE_SIZE));
  const auditTotalPages = Math.max(1, Math.ceil((auditCount ?? 0) / PAGE_SIZE));

  // Giữ số trang của các bảng còn lại khi chuyển trang trong một bảng.
  const keep = (others: Record<string, number>) => {
    const out: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(others)) out[k] = v > 1 ? String(v) : null;
    return out;
  };

  const variantMap = new Map((variants ?? []).map((v) => [v.id, v]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const nameOf = (id: string | null) => (id ? variantMap.get(id)?.products?.name ?? "—" : "—");
  const labelOf = (id: string | null) => {
    const v = id ? variantMap.get(id) : undefined;
    return v ? variantLabel(v.attributes, v.unit) : "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/api/export?report=stock" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          Xuất CSV · Tồn kho
        </Link>
        <Link href="/api/export?report=movements" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          Xuất CSV · Biến động
        </Link>
        <StockPdfButton locations={locations ?? []} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Tồn kho</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vật tư</TableHead><TableHead>Biến thể</TableHead><TableHead>Tồn</TableHead><TableHead>Tối thiểu</TableHead><TableHead>Đơn giá</TableHead><TableHead>Giá trị tồn</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(stock ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chưa có dữ liệu tồn kho.</TableCell></TableRow>}
              {(stock ?? []).map((s, i) => {
                const price = s.variant_id ? variantMap.get(s.variant_id)?.price ?? null : null;
                const qty = s.quantity ?? 0;
                const isOut = qty === 0;
                const isLow = !isOut && qty <= (s.min_stock ?? 0);
                // Nền nhạt + chữ đậm cho dòng cần cảnh báo (thắng nền zebra bằng !).
                const rowCls = isOut
                  ? "bg-red-50! hover:bg-red-100!"
                  : isLow
                    ? "bg-amber-50! hover:bg-amber-100!"
                    : "";
                const qtyCls = isOut
                  ? "font-bold text-red-700"
                  : isLow
                    ? "font-semibold text-amber-900"
                    : "tabular-nums";
                return (
                  <TableRow key={i} className={rowCls}>
                    <TableCell>{nameOf(s.variant_id)}</TableCell>
                    <TableCell className="text-muted-foreground">{labelOf(s.variant_id)}</TableCell>
                    <TableCell className={`${qtyCls} tabular-nums`}>{qty}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{s.min_stock ?? 0}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{price != null ? formatVnd(price) : "—"}</TableCell>
                    <TableCell className="tabular-nums">{price != null ? formatVnd(qty * price) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination
            basePath="/reports"
            page={stockPage}
            totalPages={stockTotalPages}
            param="stock_page"
            params={keep({ expiring_page: expiringPage, movement_page: movementPage, audit_page: auditPage })}
            className="mt-4"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sắp hết hạn (≤ 30 ngày)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vật tư</TableHead><TableHead>Lô</TableHead><TableHead>Hạn sử dụng</TableHead><TableHead>SL</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(expiring ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Không có vật tư sắp hết hạn.</TableCell></TableRow>}
              {(expiring ?? []).map((e, i) => {
                // Ngày hiện tại (Y-M-D) để so theo ngày, không theo giờ.
                const today = new Date();
                const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                const daysLeft = e.expiry_date
                  ? Math.round((new Date(`${e.expiry_date}T00:00:00`).getTime() - new Date(`${ymd(today)}T00:00:00`).getTime()) / 86400000)
                  : null;
                const expired = daysLeft !== null && daysLeft < 0;
                const soon = !expired && daysLeft !== null && daysLeft <= 7;
                const rowCls = expired
                  ? "bg-red-50! hover:bg-red-100!"
                  : soon
                    ? "bg-amber-50! hover:bg-amber-100!"
                    : "";
                const dateCls = expired
                  ? "font-bold text-red-700"
                  : soon
                    ? "font-semibold text-amber-900"
                    : "text-muted-foreground";
                return (
                  <TableRow key={i} className={rowCls}>
                    <TableCell>{nameOf(e.variant_id)}</TableCell>
                    <TableCell className="text-muted-foreground">{e.batch_no ?? "—"}</TableCell>
                    <TableCell className={dateCls}>{formatDate(e.expiry_date)}</TableCell>
                    <TableCell className="tabular-nums">{e.quantity}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination
            basePath="/reports"
            page={expiringPage}
            totalPages={expiringTotalPages}
            param="expiring_page"
            params={keep({ stock_page: stockPage, movement_page: movementPage, audit_page: auditPage })}
            className="mt-4"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Lịch sử biến động kho</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vật tư</TableHead><TableHead>Loại</TableHead><TableHead>SL</TableHead><TableHead>Thời gian</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(movements ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Chưa có biến động kho.</TableCell></TableRow>}
              {(movements ?? []).map((m, i) => (
                <TableRow key={i}>
                  <TableCell>{nameOf(m.variant_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{MOVEMENT_TYPE[m.movement_type] ?? m.movement_type}</TableCell>
                  <TableCell className="tabular-nums">{m.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            basePath="/reports"
            page={movementPage}
            totalPages={movementTotalPages}
            param="movement_page"
            params={keep({ stock_page: stockPage, expiring_page: expiringPage, audit_page: auditPage })}
            className="mt-4"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Nhật ký hoạt động (audit)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Hành động</TableHead><TableHead>Đối tượng</TableHead><TableHead>Người thực hiện</TableHead><TableHead>Thời gian</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(audits ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Chưa có nhật ký hoạt động.</TableCell></TableRow>}
              {(audits ?? []).map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{a.action}</TableCell>
                  <TableCell className="text-muted-foreground">{a.entity_type ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{a.actor_id ? profileMap.get(a.actor_id)?.name ?? "—" : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(a.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            basePath="/reports"
            page={auditPage}
            totalPages={auditTotalPages}
            param="audit_page"
            params={keep({ stock_page: stockPage, expiring_page: expiringPage, movement_page: movementPage })}
            className="mt-4"
          />
        </CardContent>
      </Card>
    </div>
  );
}
