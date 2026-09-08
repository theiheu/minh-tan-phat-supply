"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  Handshake,
  Home,
  Printer,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { PartnersReportTab } from "./partners-report-tab";
import {
  getPresetRange,
  ReportDateFilters,
  type StockLocationOption,
} from "./report-date-filters";
import { StockCardTab, type StockVariantOption } from "./stock-card-tab";
import { VehicleReportTab } from "./vehicle-report-tab";
import { ZoneCostReportTab } from "./zone-cost-report-tab";

export type ReportTab = "general" | "zones" | "vehicles" | "partners" | "stock_card";

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
  const isInitialMount = useRef(true);

  const loadData = useCallback(
    async (tab: ReportTab, range: typeof dateRange, variantId: string) => {
      setIsLoading(true);
      try {
        switch (tab) {
          case "general": {
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
      if (activeTab === "general" && initialGeneralData) {
        return;
      }
    }
    loadData(activeTab, dateRange, selectedVariantId);
  }, [activeTab, dateRange, selectedVariantId, loadData, initialGeneralData]);

  // Export / Print URL generation
  const exportType = getExportType(activeTab);
  const isExportDisabled = activeTab === "stock_card" && !selectedVariantId;

  const buildReportUrl = (endpoint: "/api/reports/export" | "/api/reports/pdf") => {
    const params = new URLSearchParams();
    params.set("type", exportType);
    params.set("from", dateRange.from);
    params.set("to", dateRange.to);
    if (dateRange.locationId && dateRange.locationId !== "all") {
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
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
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

      {/* 2. Global Date & Location Filter Bar */}
      <ReportDateFilters
        value={dateRange}
        onChange={setDateRange}
        locations={locations}
        showLocation={true}
      />

      {/* 3. Main Report Hub Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportTab)}
        className="space-y-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid h-auto w-full grid-cols-2 p-1 sm:inline-flex sm:w-auto sm:flex-row">
            <TabsTrigger
              value="general"
              onClick={() => setActiveTab("general")}
              className="gap-1.5 py-1.5 text-xs"
            >
              <BarChart3 className="size-3.5 text-blue-500" aria-hidden="true" />
              <span>📊 Báo cáo Chung</span>
            </TabsTrigger>
            <TabsTrigger
              value="zones"
              onClick={() => setActiveTab("zones")}
              className="gap-1.5 py-1.5 text-xs"
            >
              <Home className="size-3.5 text-amber-500" aria-hidden="true" />
              <span>🏠 Theo Chuồng</span>
            </TabsTrigger>
            <TabsTrigger
              value="vehicles"
              onClick={() => setActiveTab("vehicles")}
              className="gap-1.5 py-1.5 text-xs"
            >
              <Truck className="size-3.5 text-emerald-500" aria-hidden="true" />
              <span>🚜 Phương tiện</span>
            </TabsTrigger>
            <TabsTrigger
              value="partners"
              onClick={() => setActiveTab("partners")}
              className="gap-1.5 py-1.5 text-xs"
            >
              <Handshake className="size-3.5 text-violet-500" aria-hidden="true" />
              <span>🤝 Đối tác</span>
            </TabsTrigger>
            <TabsTrigger
              value="stock_card"
              onClick={() => setActiveTab("stock_card")}
              className="gap-1.5 py-1.5 text-xs"
            >
              <BookOpen className="size-3.5 text-primary" aria-hidden="true" />
              <span>📑 Sổ Thẻ kho</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: General Overview & XNT */}
        <TabsContent value="general" className="space-y-6">
          <GeneralReportTab data={generalData} isLoading={isLoading} />
        </TabsContent>

        {/* Tab 2: Zone Cost Analysis */}
        <TabsContent value="zones" className="space-y-6">
          <ZoneCostReportTab data={zoneCostData} isLoading={isLoading} />
        </TabsContent>

        {/* Tab 3: Vehicle Fuel Consumption */}
        <TabsContent value="vehicles" className="space-y-6">
          <VehicleReportTab data={vehicleData} isLoading={isLoading} />
        </TabsContent>

        {/* Tab 4: Suppliers & Customers Analytics */}
        <TabsContent value="partners" className="space-y-6">
          <PartnersReportTab data={partnersData} isLoading={isLoading} />
        </TabsContent>

        {/* Tab 5: Detailed Stock Card Ledger */}
        <TabsContent value="stock_card" className="space-y-6">
          <StockCardTab
            variants={variants}
            locations={locations}
            data={stockCardData}
            selectedVariantId={selectedVariantId}
            onSelectVariant={setSelectedVariantId}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
