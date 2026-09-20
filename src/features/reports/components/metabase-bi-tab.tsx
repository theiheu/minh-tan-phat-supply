"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, ExternalLink, Maximize2, Minimize2, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMetabaseDashboardAction, type MetabaseDashboardResult } from "../actions";
import { METABASE_DASHBOARDS } from "@/lib/metabase";

export function MetabaseBiTab() {
 const [selectedId,setSelectedId]=useState(METABASE_DASHBOARDS[0].id); const [data,setData]=useState<MetabaseDashboardResult|null>(null);
 const [loading,setLoading]=useState(true); const [iframeLoading,setIframeLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [fullscreen,setFullscreen]=useState(false); const seq=useRef(0);
 const load=useCallback(async(id=selectedId)=>{const request=++seq.current;setLoading(true);setIframeLoading(true);setError(null);try{const result=await getMetabaseDashboardAction({dashboardId:id});if(request===seq.current){setData(result);if(!result.embedUrl)setIframeLoading(false);}}catch(e){if(request===seq.current){setData(null);setIframeLoading(false);setError(e instanceof Error?e.message:"Không thể kết nối dịch vụ phân tích");}}finally{if(request===seq.current)setLoading(false);}},[selectedId]);
 useEffect(()=>{void load(selectedId);},[selectedId,load]);
 const current=data?.dashboard??METABASE_DASHBOARDS.find(d=>d.id===selectedId)??METABASE_DASHBOARDS[0];
 return <div className="space-y-4">
  <Card><CardHeader className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><CardTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-primary"/>Phân tích chuyên sâu với Metabase BI</CardTitle><p className="mt-1 text-sm text-muted-foreground">Khám phá biểu đồ, xu hướng và drill-down ngoài các sổ nghiệp vụ.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCw className={`size-4 ${loading?"animate-spin":""}`}/>Làm mới</Button>{data?.directUrl&&<Button asChild variant="outline" size="sm"><a href={data.directUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4"/>Mở Metabase Studio</a></Button>}<Button size="sm" variant="secondary" onClick={()=>setFullscreen(v=>!v)}>{fullscreen?<Minimize2 className="size-4"/>:<Maximize2 className="size-4"/>}{fullscreen?"Thu gọn":"Toàn màn hình"}</Button></div></div>
  <div className="flex gap-2 overflow-x-auto pb-1">{METABASE_DASHBOARDS.map(d=><button key={d.id} type="button" onClick={()=>setSelectedId(d.id)} aria-pressed={selectedId===d.id} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${selectedId===d.id?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground hover:text-foreground"}`}>{d.title}</button>)}</div></CardHeader><CardContent><p className="text-sm"><span className="font-semibold">{current.title}:</span> <span className="text-muted-foreground">{current.description}</span></p></CardContent></Card>
  <div className={`relative overflow-hidden rounded-xl border bg-background ${fullscreen?"fixed inset-2 z-50 flex flex-col p-4":"min-h-[650px]"}`}>{fullscreen&&<div className="mb-3 flex items-center justify-between"><strong>{current.title}</strong><Button variant="outline" size="sm" onClick={()=>setFullscreen(false)}><Minimize2 className="size-4"/>Đóng toàn màn hình</Button></div>}
   {(loading||iframeLoading)&&!error&&<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90"><RefreshCw className="size-8 animate-spin text-primary"/><p className="mt-3 text-sm font-medium">Đang tải dashboard phân tích…</p></div>}
   {error?<div className="flex min-h-[500px] flex-col items-center justify-center p-6 text-center"><TriangleAlert className="size-10 text-amber-500"/><h3 className="mt-3 font-semibold">Chưa thể mở dashboard phân tích</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p><Button className="mt-4" onClick={()=>void load()}>Thử lại</Button></div>:data?.embedUrl?<iframe src={data.embedUrl} title={current.title} className="h-[720px] w-full border-0" onLoad={()=>setIframeLoading(false)} onError={()=>{setIframeLoading(false);setError("Dashboard không phản hồi. Hãy thử lại hoặc mở Metabase Studio.");}} allow="fullscreen"/>:<div className="flex min-h-[500px] items-center justify-center text-sm text-muted-foreground">Dịch vụ phân tích chưa được cấu hình.</div>}
  </div>
 </div>;
}
