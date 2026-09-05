import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { MOVEMENT_TYPE, variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const [{ data: variants }, { data: profiles }, { data: stock }, { data: movements }, { data: expiring }, { data: audits }] =
    await Promise.all([
      supabase.from("variants").select("id, attributes, unit, products(name)"),
      supabase.from("profiles").select("id, name"),
      supabase.from("variant_stock").select("variant_id, quantity, min_stock").order("quantity", { ascending: true }).limit(200),
      supabase.from("stock_movements").select("variant_id, movement_type, quantity, created_at").order("created_at", { ascending: false }).limit(100),
      supabase
        .from("receipt_items")
        .select("variant_id, quantity, batch_no, expiry_date")
        .lte("expiry_date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
        .order("expiry_date", { ascending: true })
        .limit(100),
      supabase.from("audit_logs").select("actor_id, action, entity_type, created_at").order("created_at", { ascending: false }).limit(50),
    ]);

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
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Tồn kho</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vật tư</TableHead><TableHead>Biến thể</TableHead><TableHead>Tồn</TableHead><TableHead>Tối thiểu</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(stock ?? []).map((s, i) => (
                <TableRow key={i}>
                  <TableCell>{nameOf(s.variant_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{labelOf(s.variant_id)}</TableCell>
                  <TableCell className={`tabular-nums ${(s.quantity ?? 0) <= (s.min_stock ?? 0) ? "font-medium text-red-600" : ""}`}>{s.quantity ?? 0}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{s.min_stock ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              {(expiring ?? []).map((e, i) => (
                <TableRow key={i}>
                  <TableCell>{nameOf(e.variant_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{e.batch_no ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(e.expiry_date)}</TableCell>
                  <TableCell className="tabular-nums">{e.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
        </CardContent>
      </Card>
    </div>
  );
}
