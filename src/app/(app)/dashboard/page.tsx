import { ClipboardList, PackageOpen, Truck, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { REQUISITION_STATUS, statusBadgeClass } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

async function loadDashboard() {
  const supabase = await createClient();
  const [products, pending, issued, receipts, recentReq] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("requisitions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("requisitions").select("*", { count: "exact", head: true }).eq("status", "issued"),
    supabase.from("receipts").select("*", { count: "exact", head: true }).eq("status", "posted"),
    supabase
      .from("requisitions")
      .select(
        "id, code, purpose, status, created_at, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name)",
      )
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    totalProducts: products.count ?? 0,
    pendingCount: pending.count ?? 0,
    issuedCount: issued.count ?? 0,
    receiptsCount: receipts.count ?? 0,
    recentRequisitions: recentReq.data ?? [],
  };
}

export default async function DashboardPage() {
  const data = await loadDashboard();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={PackageOpen} label="Tổng vật tư" value={data.totalProducts} />
        <StatCard icon={ClipboardList} label="Phiếu đang chờ" value={data.pendingCount} />
        <StatCard icon={Truck} label="Đã cấp chưa nhận" value={data.issuedCount} />
        <StatCard icon={Users} label="Phiếu nhập đã ghi" value={data.receiptsCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phiếu yêu cầu cần xử lý</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentRequisitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có phiếu yêu cầu đang chờ xử lý.</p>
          ) : (
            <ul className="divide-y">
              {data.recentRequisitions.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/requisitions/${r.id}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:text-primary"
                  >
                    <span className="font-mono text-sm">{r.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {r.requester?.name ?? "—"} · {r.purpose}
                    </span>
                    <Badge variant="outline" className={statusBadgeClass(r.status)}>
                      {REQUISITION_STATUS[r.status] ?? r.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
