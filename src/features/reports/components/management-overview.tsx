"use client";

import { AlertTriangle, ArrowRight, Boxes, Fuel, PackagePlus, PackageMinus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVnd } from "@/lib/format";
import type { ManagementOverviewData, OperationalReportKey, ReportSection } from "../types";

export function ManagementOverview({ data, isLoading, error, onNavigate }: {
  data: ManagementOverviewData | null; isLoading?: boolean; error?: string | null;
  onNavigate: (section: ReportSection, report?: OperationalReportKey) => void;
}) {
  if (isLoading && !data) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Đang tải tổng quan">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>;
  if (error && !data) return <Card className="border-destructive/40"><CardContent className="py-10 text-center"><AlertTriangle className="mx-auto mb-3 size-8 text-destructive"/><p className="font-semibold">Không thể tải tổng quan quản trị</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></CardContent></Card>;
  if (!data) return <Card><CardContent className="py-10 text-center text-muted-foreground">Không có dữ liệu trong kỳ đã chọn.</CardContent></Card>;
  const kpis = [
    { label: "Giá trị tồn kho", value: formatVnd(data.general.totalInventoryValue), icon: Boxes, color: "text-blue-600" },
    { label: "Nhập trong kỳ", value: formatVnd(data.general.totalImportValue), icon: PackagePlus, color: "text-emerald-600" },
    { label: "Chi phí xuất dùng", value: formatVnd(data.general.totalIssuedCost), icon: PackageMinus, color: "text-amber-600" },
    { label: "Chi phí nhiên liệu", value: formatVnd(data.general.fuelSummary.estimatedCost), icon: Fuel, color: "text-violet-600" },
  ];
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(({label,value,icon:Icon,color}) => <Card key={label}><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold tracking-tight">{value}</p></div><span className="rounded-lg bg-muted p-2"><Icon className={`size-5 ${color}`} /></span></CardContent></Card>)}</div>
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-5 text-amber-500"/>Tín hiệu cần chú ý</CardTitle></CardHeader><CardContent className="space-y-2">{data.alerts.map((alert) => <button type="button" key={alert.id} onClick={() => onNavigate(alert.targetSection, alert.targetReport)} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/60"><span className={`size-2.5 shrink-0 rounded-full ${alert.severity === "critical" ? "bg-red-500" : alert.severity === "warning" ? "bg-amber-500" : "bg-emerald-500"}`}/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{alert.title}</span><span className="block truncate text-xs text-muted-foreground">{alert.description}</span></span><span className="text-sm font-bold">{alert.value}</span><ArrowRight className="size-4 text-muted-foreground"/></button>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Điểm nóng trong kỳ</CardTitle></CardHeader><CardContent className="space-y-5"><Ranking title="Chi phí theo trại" rows={data.zones.zones.slice().sort((a,b)=>b.totalCost-a.totalCost).slice(0,3).map(z=>({label:z.zoneName,value:formatVnd(z.totalCost),percent:z.percentage}))} empty="Chưa có chi phí theo trại"/><Ranking title="Phương tiện tiêu hao nhiều" rows={data.vehicles.vehicles.slice().sort((a,b)=>b.totalLiters-a.totalLiters).slice(0,3).map(v=>({label:v.code,value:`${v.totalLiters.toLocaleString("vi-VN")} L`,percent:data.vehicles.totalLitersAllVehicles ? v.totalLiters/data.vehicles.totalLitersAllVehicles*100 : 0}))} empty="Chưa có dữ liệu phương tiện"/></CardContent></Card>
    </div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onNavigate("operations","xnt")}>Xem XNT</Button><Button variant="outline" onClick={() => onNavigate("operations","zones")}>Chi phí theo trại</Button><Button variant="outline" onClick={() => onNavigate("operations","vehicles")}>Phương tiện</Button><Button onClick={() => onNavigate("bi")}><ShieldCheck className="size-4"/>Mở phân tích BI</Button></div>
    <p className="text-xs text-muted-foreground">Cập nhật lúc {new Date(data.generatedAt).toLocaleString("vi-VN")}</p>
  </div>;
}
function Ranking({ title, rows, empty }: { title: string; rows: {label:string;value:string;percent:number}[]; empty:string }) { return <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{rows.length ? <div className="space-y-3">{rows.map(row=><div key={row.label}><div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate font-medium">{row.label}</span><span>{row.value}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${Math.min(100,Math.max(4,row.percent))}%`}}/></div></div>)}</div>:<p className="text-sm text-muted-foreground">{empty}</p>}</div>; }
