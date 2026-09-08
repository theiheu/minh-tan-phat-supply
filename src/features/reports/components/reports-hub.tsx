"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Boxes,
  FileSpreadsheet,
  Handshake,
  Home,
  Printer,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getGeneralReportAction,
  getPartnersReportAction,
  getStockCardAction,
  getVehicleReportAction,
  getZoneCostReportAction,
} from "../actions";
import type {
  DatePreset,
  GeneralReportData,
  PartnersReportData,
  StockCardData,
  VehicleReportData,
  ZoneCostReportData,
} from "../types";
import { GeneralReportTab } from "./general-report-tab";
import { XntReportTab } from "./xnt-report-tab";
import { PartnersReportTab } from "./partners-report-tab";
import {
  getPresetRange,
  ReportDateFilters,
  type StockLocationOption,
} from "./report-date-filters";
import { StockCardTab, type StockVariantOption } from "./stock-card-tab";
import { VehicleReportTab } from "./vehicle-report-tab";
import { ZoneCostReportTab } from "./zone-cost-report-tab";

export type ReportTab = "general" | "xnt" | "zones" | "vehicles" | "partners" | "stock_card";

export interface ReportsHubProps {
  initialGeneralData?: GeneralReportData | null;
  locations?: StockLocationOption[];
  variants?: StockVariantOption[];
  initialDateRange?: {
    from: string;
    to: string;
    preset: DatePreset;
    locationId?: string;
  };
}

/**
 * Maps the active tab key to the server export/PDF type identifier.
 */
export function getExportType(tab: ReportTab): string {
  switch (tab) {
    case "general":
    case "xnt":
      return "stock_ledger";
    case "zones":
      return "zone_cost";
    case "vehicles":
      return "vehicles";
    case "partners":
      return "partners";
    case "stock_card":
      return "stock_card";
  }
}

export function ReportsHub({
  initialGeneralData = null,
  locations = [],
  variants = [],
  initialDateRange,
}: ReportsHubProps) {
  // Default to current month date range if none provided
  const [dateRange, setDateRange] = useState<{
    from: string;
    to: string;
    preset: DatePreset;
    locationId?: string;
  }>(() => {
    if (initialDateRange) return initialDateRange;
    const defaultRange = getPresetRange("this_month");
    return {
      from: defaultRange.from,
      to: defaultRange.to,
      preset: "this_month",
      locationId: undefined,
    };
  });

  const [activeTab, setActiveTab] = useState<ReportTab>("general");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

  // Data cache for tabs
  const [generalData, setGeneralData] = useState<GeneralReportData | null>(initialGeneralData);
  const [zoneCostData, setZoneCostData] = useState<ZoneCostReportData | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleReportData | null>(null);
  const [partnersData, setPartnersData] = useState<PartnersReportData | null>(null);
  const [stockCardData, setStockCardData] = useState<StockCardData | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isInitialMount = useRef<boolean>(true);

  // Load active tab data from server
  const loadTabData = useCallback(
    async (tab: ReportTab, range: typeof dateRange, variantId: string) => {
      setIsLoading(true);
      try {
        switch (tab) {
          case "general":
          case "xnt": {
            const res = await getGeneralReportAction({
              locationId: range.locationId,
              from: range.from,
              to: range.to,
            });
            setGeneralData(res);
            break;
          }
          case "zones": {
            const res = await getZoneCostReportAction({
              from: range.from,
              to: range.to,
            });
            setZoneCostData(res);
            break;
          }
          case "vehicles": {
            const res = await getVehicleReportAction({
              from: range.from,
              to: range.to,
            });
            setVehicleData(res);
            break;
          }
          case "partners": {
            const res = await getPartnersReportAction({
              from: range.from,
              to: range.to,
            });
            setPartnersData(res);
            break;
          }
          case "stock_card": {
            if (variantId) {
              const res = await getStockCardAction({
                variantId,
                locationId: range.locationId,
                from: range.from,
                to: range.to,
              });
              setStockCardData(res);
            } else {
              setStockCardData(null);
            }
            break;
          }
        }
      } catch (err) {
        console.error("Failed to load report data:", err);
        const msg = err instanceof Error ? err.message : "Lỗi tải dữ liệu báo cáo";
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // Skip fetching general data on mount if already supplied by server component
      if ((activeTab === "general" || activeTab === "xnt") && initialGeneralData) {
        return;
      }
    }

    loadTabData(activeTab, dateRange, selectedVariantId);
  }, [activeTab, dateRange, selectedVariantId, loadTabData, initialGeneralData]);

  // Check if export is allowed for current tab
  const isExportDisabled = activeTab === "stock_card" && !selectedVariantId;

  // Build export URLs
  const buildReportUrl = (endpoint: string): string => {
    const params = new URLSearchParams();
    params.set("type", getExportType(activeTab));
    params.set("from", dateRange.from);
    params.set("to", dateRange.to);
    if (dateRange.locationId) {
      params.set("location", dateRange.locationId);
    }
    if (activeTab === "stock_card" && selectedVariantId) {
      params.set("variantId", selectedVariantId);
    }
    return `${endpoint}?${params.toString()}`;
  };

  const exportUrl = buildReportUrl("/api/reports/export");
  const pdfUrl = buildReportUrl("/api/reports/pdf");

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Subnav Tabs - Top Navigation (styled like /fuel) */}
      <div className="overflow-x-auto border-b pb-0.5 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <nav role="tablist" className="-mb-px flex min-w-max space-x-2 sm:space-x-6">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "general"}
            onClick={() => setActiveTab("general")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "general"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <BarChart3 className="size-3.5 sm:size-4 text-blue-500" aria-hidden="true" />
            <span>📊 Tổng quan</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "xnt"}
            onClick={() => setActiveTab("xnt")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "xnt"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Boxes className="size-3.5 sm:size-4 text-indigo-500" aria-hidden="true" />
            <span>📦 Xuất - Nhập - Tồn</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "zones"}
            onClick={() => setActiveTab("zones")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "zones"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Home className="size-3.5 sm:size-4 text-amber-500" aria-hidden="true" />
            <span>🏠 Theo Chuồng</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "vehicles"}
            onClick={() => setActiveTab("vehicles")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "vehicles"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Truck className="size-3.5 sm:size-4 text-emerald-500" aria-hidden="true" />
            <span>🚜 Phương tiện</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "partners"}
            onClick={() => setActiveTab("partners")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "partners"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Handshake className="size-3.5 sm:size-4 text-violet-500" aria-hidden="true" />
            <span>🤝 Đối tác</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "stock_card"}
            onClick={() => setActiveTab("stock_card")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "stock_card"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <BookOpen className="size-3.5 sm:size-4 text-primary" aria-hidden="true" />
            <span>📑 Sổ Thẻ kho</span>
          </button>
        </nav>
      </div>

      {/* 2. Header & Quick Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Trung tâm Báo cáo & Thống kê
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Trại gà đẻ trứng Lê Văn Dương · Hệ thống tổng hợp số liệu quản lý và phân tích hoạt động
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Excel Export Button */}
          {isExportDisabled ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              title="Vui lòng chọn một vật tư trước khi xuất Excel"
            >
              <FileSpreadsheet className="size-3.5" aria-hidden="true" />
              <span>Xuất Excel (.xlsx)</span>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs shadow-xs">
              <a href={exportUrl} download>
                <FileSpreadsheet
                  className="size-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span>Xuất Excel (.xlsx)</span>
              </a>
            </Button>
          )}

          {/* PDF Print Button */}
          {isExportDisabled ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              title="Vui lòng chọn một vật tư trước khi in PDF"
            >
              <Printer className="size-3.5" aria-hidden="true" />
              <span>In Báo Cáo PDF</span>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs shadow-xs">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Printer className="size-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span>In Báo Cáo PDF</span>
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* 3. Global Date & Location Filter Bar (Placed below tabs) */}
      <ReportDateFilters
        value={dateRange}
        onChange={setDateRange}
        locations={locations}
        showLocation={true}
      />

      {/* 4. Tab Contents */}
      <div className="space-y-6">
        {activeTab === "general" && (
          <GeneralReportTab
            data={generalData}
            isLoading={isLoading}
            onNavigateToXnt={() => setActiveTab("xnt")}
          />
        )}
        {activeTab === "xnt" && (
          <XntReportTab data={generalData} isLoading={isLoading} />
        )}
        {activeTab === "zones" && (
          <ZoneCostReportTab data={zoneCostData} isLoading={isLoading} />
        )}
        {activeTab === "vehicles" && (
          <VehicleReportTab data={vehicleData} isLoading={isLoading} />
        )}
        {activeTab === "partners" && (
          <PartnersReportTab data={partnersData} isLoading={isLoading} />
        )}
        {activeTab === "stock_card" && (
          <StockCardTab
            variants={variants}
            locations={locations}
            data={stockCardData}
            selectedVariantId={selectedVariantId}
            onSelectVariant={setSelectedVariantId}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
