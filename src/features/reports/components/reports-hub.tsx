"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getGeneralReportAction, getManagementOverviewAction, getPartnersReportAction, getStockCardAction, getVehicleReportAction, getZoneCostReportAction } from "../actions";
import type { DatePreset, GeneralReportData, ManagementOverviewData, OperationalReportKey, PartnersReportData, ReportSection, StockCardData, VehicleReportData, ZoneCostReportData } from "../types";
import { ManagementOverview } from "./management-overview";
import { MetabaseBiTab } from "./metabase-bi-tab";
import { PartnersReportTab } from "./partners-report-tab";
import { ReportDateFilters, type StockLocationOption } from "./report-date-filters";
import { OPERATIONAL_REPORTS, ReportSectionNav } from "./report-section-nav";
import { StockCardTab, type StockVariantOption } from "./stock-card-tab";
import { VehicleReportTab } from "./vehicle-report-tab";
import { XntReportTab } from "./xnt-report-tab";
import { ZoneCostReportTab } from "./zone-cost-report-tab";

export interface ReportsHubProps {
  initialOverviewData?: ManagementOverviewData | null; initialGeneralData?: GeneralReportData | null;
  locations?: StockLocationOption[]; variants?: StockVariantOption[];
  initialDateRange: { from:string; to:string; preset:DatePreset; locationId?:string };
  initialSection?: ReportSection; initialReport?: OperationalReportKey;
}

const exportTypes: Record<OperationalReportKey,string> = { xnt:"stock_ledger", zones:"zone_cost", vehicles:"vehicles", partners:"partners", stock_card:"stock_card" };
export function getExportType(report: OperationalReportKey) { return exportTypes[report]; }

function parseLocation(): { section:ReportSection; report:OperationalReportKey } {
  if (typeof window === "undefined") return { section:"overview", report:"xnt" };
  const params = new URLSearchParams(window.location.search); const s=params.get("section"); const r=params.get("report");
  const validReport = !r || r in exportTypes;
  const section: ReportSection = s === "bi" ? "bi" : s === "operations" && validReport ? "operations" : "overview";
  const report: OperationalReportKey = r && r in exportTypes ? r as OperationalReportKey : "xnt";
  return { section, report };
}

export function ReportsHub({ initialOverviewData=null, initialGeneralData=null, locations=[], variants=[], initialDateRange, initialSection="overview", initialReport="xnt" }: ReportsHubProps) {
  const [section,setSection]=useState<ReportSection>(initialSection); const [report,setReport]=useState<OperationalReportKey>(initialReport);
  const [dateRange,setDateRange]=useState(initialDateRange); const [selectedVariantId,setSelectedVariantId]=useState("");
  const [overview,setOverview]=useState(initialOverviewData); const [general,setGeneral]=useState(initialGeneralData ?? initialOverviewData?.general ?? null);
  const [zones,setZones]=useState<ZoneCostReportData|null>(initialOverviewData?.zones ?? null); const [vehicles,setVehicles]=useState<VehicleReportData|null>(initialOverviewData?.vehicles ?? null);
  const [partners,setPartners]=useState<PartnersReportData|null>(null); const [stockCard,setStockCard]=useState<StockCardData|null>(null);
  const [loading,setLoading]=useState(false); const [error,setError]=useState<string|null>(null); const requestSeq=useRef(0); const first=useRef(true);

  const updateUrl=useCallback((nextSection:ReportSection,nextReport=report,replace=false)=>{
    if(typeof window==="undefined") return; const url=new URL(window.location.href);
    if(nextSection==="overview"){url.searchParams.delete("section");url.searchParams.delete("report");} else {url.searchParams.set("section",nextSection); if(nextSection==="operations") url.searchParams.set("report",nextReport); else url.searchParams.delete("report");}
    window.history[replace?"replaceState":"pushState"]({},"",url);
  },[report]);
  const navigate=useCallback((nextSection:ReportSection,nextReport?:OperationalReportKey)=>{const resolved=nextReport??report;setSection(nextSection);if(nextReport)setReport(nextReport);updateUrl(nextSection,resolved);},[report,updateUrl]);
  useEffect(()=>{const onPop=()=>{const next=parseLocation();setSection(next.section);setReport(next.report);};window.addEventListener("popstate",onPop);return()=>window.removeEventListener("popstate",onPop);},[]);

  const load=useCallback(async()=>{
    const seq=++requestSeq.current; setLoading(true); setError(null);
    try {
      if(section==="overview"){const data=await getManagementOverviewAction(dateRange);if(seq===requestSeq.current){setOverview(data);setGeneral(data.general);setZones(data.zones);setVehicles(data.vehicles);}}
      else if(section==="operations"){
        if(report==="xnt"){const data=await getGeneralReportAction(dateRange);if(seq===requestSeq.current)setGeneral(data);}
        if(report==="zones"){const data=await getZoneCostReportAction(dateRange);if(seq===requestSeq.current)setZones(data);}
        if(report==="vehicles"){const data=await getVehicleReportAction(dateRange);if(seq===requestSeq.current)setVehicles(data);}
        if(report==="partners"){const data=await getPartnersReportAction(dateRange);if(seq===requestSeq.current)setPartners(data);}
        if(report==="stock_card"){if(!selectedVariantId){if(seq===requestSeq.current)setStockCard(null);}else{const data=await getStockCardAction({...dateRange,variantId:selectedVariantId});if(seq===requestSeq.current)setStockCard(data);}}
      }
    } catch(e){if(seq===requestSeq.current){const message=e instanceof Error?e.message:"Lỗi tải dữ liệu báo cáo";setError(message);if(section==="overview")setOverview(null);else if(report==="xnt")setGeneral(null);else if(report==="zones")setZones(null);else if(report==="vehicles")setVehicles(null);else if(report==="partners")setPartners(null);else setStockCard(null);toast.error(message);}} finally {if(seq===requestSeq.current)setLoading(false);}
  },[section,report,dateRange,selectedVariantId]);
  useEffect(()=>{if(first.current){first.current=false; if(section==="overview"&&initialOverviewData)return; if(section==="operations"&&report==="xnt"&&initialGeneralData)return; if(section==="bi")return;} if(section!=="bi")void load();},[section,report,dateRange,selectedVariantId,load,initialOverviewData,initialGeneralData]);

  const params=new URLSearchParams({type:getExportType(report),from:dateRange.from,to:dateRange.to}); if(dateRange.locationId)params.set("location",dateRange.locationId); if(report==="stock_card"&&selectedVariantId)params.set("variantId",selectedVariantId);
  const exportDisabled=report==="stock_card"&&!selectedVariantId; const reportMeta=OPERATIONAL_REPORTS.find(item=>item.key===report)!;
  return <div className="space-y-5">
    <header><p className="text-sm font-medium text-primary">Trung tâm điều hành</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Báo cáo & Phân tích</h1><p className="mt-1 text-sm text-muted-foreground">Theo dõi tín hiệu quản trị, đối soát sổ sách và khám phá dữ liệu chuyên sâu.</p></header>
    <ReportSectionNav section={section} report={report} onSectionChange={navigate} onReportChange={(next)=>navigate("operations",next)}/>
    <section id="report-section-panel" role="tabpanel" aria-labelledby={`report-section-${section}`} className="space-y-4">
      {section!=="bi"&&<ReportDateFilters value={dateRange} onChange={setDateRange} locations={locations} showLocation={section==="overview"||report==="xnt"||report==="stock_card"} actions={section==="operations"?<div className="flex gap-2"><ExportButton disabled={exportDisabled} href={`/api/reports/export?${params}`} label="Excel" icon="excel"/><ExportButton disabled={exportDisabled} href={`/api/reports/pdf?${params}`} label="PDF" icon="pdf" newTab/></div>:undefined}/>}
      {section==="overview"&&<ManagementOverview data={overview} isLoading={loading} error={error} onNavigate={navigate}/>}
      {section==="operations"&&<div className="space-y-4"><div><h2 className="text-xl font-bold">{reportMeta.label}</h2><p className="text-sm text-muted-foreground">{reportMeta.description}</p>{error&&<p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}</div>{report==="xnt"&&<XntReportTab data={general} isLoading={loading}/>} {report==="zones"&&<ZoneCostReportTab data={zones} isLoading={loading}/>} {report==="vehicles"&&<VehicleReportTab data={vehicles} isLoading={loading}/>} {report==="partners"&&<PartnersReportTab data={partners} isLoading={loading}/>} {report==="stock_card"&&<StockCardTab variants={variants} locations={locations} data={stockCard} selectedVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} isLoading={loading}/>}</div>}
      {section==="bi"&&<MetabaseBiTab/>}
    </section>
  </div>;
}
function ExportButton({disabled,href,label,icon,newTab}:{disabled:boolean;href:string;label:string;icon:"excel"|"pdf";newTab?:boolean}){const Icon=icon==="excel"?FileSpreadsheet:Printer;if(disabled)return <Button disabled variant="outline" size="sm" title="Vui lòng chọn một vật tư trước"><Icon className="size-4"/>{label}</Button>;return <Button asChild variant="outline" size="sm"><a href={href} target={newTab?"_blank":undefined} rel={newTab?"noopener noreferrer":undefined} download={!newTab||undefined} aria-label={icon==="excel"?"Xuất Excel (.xlsx)":"In Báo Cáo PDF"}><Icon className="size-4"/>{label}</a></Button>}
