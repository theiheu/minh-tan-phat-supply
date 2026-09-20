"use client";

import { BarChart3, BookOpenCheck, Sparkles } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { OperationalReportKey, ReportSection } from "../types";

export const OPERATIONAL_REPORTS: { key: OperationalReportKey; label: string; description: string }[] = [
  { key: "xnt", label: "Xuất – Nhập – Tồn", description: "Đối soát số lượng và giá trị tồn kho" },
  { key: "zones", label: "Chi phí theo trại", description: "Phân bổ vật tư theo khu vực" },
  { key: "vehicles", label: "Tiêu hao phương tiện", description: "Theo dõi nhiên liệu và định mức" },
  { key: "partners", label: "Đối tác", description: "Nhà cung cấp và khách hàng" },
  { key: "stock_card", label: "Sổ thẻ kho", description: "Bút toán chi tiết theo vật tư" },
];

const sections: { key: ReportSection; label: string; description: string; icon: typeof BarChart3 }[] = [
  { key: "overview", label: "Tổng quan quản trị", description: "KPI và tín hiệu cần chú ý", icon: BarChart3 },
  { key: "operations", label: "Báo cáo nghiệp vụ", description: "Sổ sách và đối soát", icon: BookOpenCheck },
  { key: "bi", label: "Phân tích chuyên sâu", description: "Dashboard Metabase BI", icon: Sparkles },
];

export function ReportSectionNav({ section, report, onSectionChange, onReportChange }: {
  section: ReportSection; report: OperationalReportKey;
  onSectionChange: (section: ReportSection) => void; onReportChange: (report: OperationalReportKey) => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % sections.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + sections.length) % sections.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sections.length - 1;
    else return;
    event.preventDefault();
    onSectionChange(sections[next].key);
    document.getElementById(`report-section-${sections[next].key}`)?.focus();
  };
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Khu vực báo cáo" className="grid gap-2 rounded-xl bg-muted/50 p-1 sm:grid-cols-3">
        {sections.map((item, index) => {
          const Icon = item.icon; const active = section === item.key;
          return <button key={item.key} id={`report-section-${item.key}`} role="tab" aria-selected={active}
            aria-controls="report-section-panel" tabIndex={active ? 0 : -1} onClick={() => onSectionChange(item.key)} onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}>
            <Icon className={`size-5 shrink-0 ${active ? "text-primary" : ""}`} aria-hidden="true" />
            <span><span className="block text-sm font-semibold">{item.label}</span><span className="hidden text-xs sm:block">{item.description}</span></span>
          </button>;
        })}
      </div>
      {section === "operations" && <div className="rounded-xl border bg-card p-3">
        <label htmlFor="operational-report" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground md:hidden">Chọn báo cáo</label>
        <select id="operational-report" value={report} onChange={(e) => onReportChange(e.target.value as OperationalReportKey)} className="h-10 w-full rounded-md border bg-background px-3 text-sm md:hidden">
          {OPERATIONAL_REPORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
        <div className="hidden grid-cols-5 gap-2 md:grid">{OPERATIONAL_REPORTS.map((item) => { const active = report === item.key; return <button type="button" key={item.key} onClick={() => onReportChange(item.key)} aria-pressed={active} className={`rounded-lg border px-3 py-2 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.description}</span></button>; })}</div>
      </div>}
    </div>
  );
}
