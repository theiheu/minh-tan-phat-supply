import Link from "next/link";
import { BarChart3, Droplets, Fuel, PackageMinus, PackagePlus, QrCode } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getFuelDispenses,
  getFuelOverview,
  getFuelReceipts,
  getFuelReportData,
  getFuelTypes,
} from "@/features/fuel/actions";
import { FuelOverview } from "@/features/fuel/components/fuel-overview";
import { FuelDispenseList, type FuelDispenseRow } from "@/features/fuel/components/fuel-dispense-list";
import { FuelReceiptList, type FuelReceiptRow } from "@/features/fuel/components/fuel-receipt-list";
import { FuelReports } from "@/features/fuel/components/fuel-reports";
import { getVehicles } from "@/features/vehicles/actions";

export const dynamic = "force-dynamic";

export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    page?: string;
    fuelTypeId?: string;
    vehicleId?: string;
    zoneId?: string;
    q?: string;
  }>;
}) {
  await requireManager();
  const sp = await searchParams;
  const tab = sp.tab ?? "overview";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const fuelTypeId = sp.fuelTypeId ?? "";
  const vehicleId = sp.vehicleId ?? "";
  const zoneId = sp.zoneId ?? "";

  // Mặc định khoảng ngày: từ đầu tháng hiện tại đến hôm nay
  const now = new Date();
  const vnYear = now.getFullYear();
  const vnMonth = String(now.getMonth() + 1).padStart(2, "0");
  const vnDay = String(now.getDate()).padStart(2, "0");
  const defaultFrom = `${vnYear}-${vnMonth}-01`;
  const defaultTo = `${vnYear}-${vnMonth}-${vnDay}`;

  const from = sp.from ?? defaultFrom;
  const to = sp.to ?? defaultTo;

  const supabase = await createClient();

  // Load basic options
  const [fuelTypes, vehiclesRaw, zonesRes, suppliersRes] = await Promise.all([
    getFuelTypes({ activeOnly: true }),
    getVehicles({ activeOnly: true }),
    supabase.from("zones").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
  ]);

  const vehicles = (vehiclesRaw ?? []).map((v) => ({
    id: v.id,
    code: v.code,
    name: v.name,
    current_odo: Number(v.current_odo),
    odo_unit: v.odo_unit,
    default_driver: v.default_driver,
    fuel_type_id: v.fuel_type_id,
    zone_id: v.zone_id,
  }));

  const zones = zonesRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];

  return (
    <div className="space-y-6">
      {/* Subnav Tabs */}
      <div className="flex border-b">
        <nav className="-mb-px flex space-x-6">
          <Link
            href="/fuel?tab=overview"
            className={`inline-flex items-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors ${
              tab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Droplets className="size-4" />
            Tổng quan & Tồn kho
          </Link>
          <Link
            href={`/fuel?tab=dispenses&from=${from}&to=${to}`}
            className={`inline-flex items-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors ${
              tab === "dispenses"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <PackageMinus className="size-4" />
            Cấp phát dầu (Xuất)
          </Link>
          <Link
            href={`/fuel?tab=receipts&from=${from}&to=${to}`}
            className={`inline-flex items-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors ${
              tab === "receipts"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <PackagePlus className="size-4" />
            Nhập kho dầu
          </Link>
          <Link
            href={`/fuel?tab=reports&from=${from}&to=${to}`}
            className={`inline-flex items-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors ${
              tab === "reports"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <BarChart3 className="size-4" />
            Báo cáo & Tiêu hao
          </Link>
        </nav>
      </div>

      {/* Tab Contents */}
      {tab === "overview" && (
        <OverviewTabContent
          fuelTypes={fuelTypes}
          vehicles={vehicles}
          zones={zones}
          suppliers={suppliers}
        />
      )}

      {tab === "dispenses" && (
        <DispensesTabContent
          from={from}
          to={to}
          page={page}
          fuelTypeId={fuelTypeId}
          vehicleId={vehicleId}
          zoneId={zoneId}
          fuelTypes={fuelTypes}
          vehicles={vehicles}
          zones={zones}
        />
      )}

      {tab === "receipts" && (
        <ReceiptsTabContent
          from={from}
          to={to}
          page={page}
          fuelTypeId={fuelTypeId}
          fuelTypes={fuelTypes}
          suppliers={suppliers}
        />
      )}

      {tab === "reports" && (
        <ReportsTabContent
          from={from}
          to={to}
          vehicleId={vehicleId}
          zoneId={zoneId}
          fuelTypes={fuelTypes}
          vehicles={vehicles}
          zones={zones}
        />
      )}
    </div>
  );
}

async function OverviewTabContent({
  fuelTypes,
  vehicles,
  zones,
  suppliers,
}: {
  fuelTypes: any[];
  vehicles: any[];
  zones: any[];
  suppliers: any[];
}) {
  const overview = await getFuelOverview();
  return (
    <FuelOverview
      overview={overview}
      fuelTypes={fuelTypes}
      vehicles={vehicles}
      zones={zones}
      suppliers={suppliers}
    />
  );
}

async function DispensesTabContent({
  from,
  to,
  page,
  fuelTypeId,
  vehicleId,
  zoneId,
  fuelTypes,
  vehicles,
  zones,
}: {
  from: string;
  to: string;
  page: number;
  fuelTypeId: string;
  vehicleId: string;
  zoneId: string;
  fuelTypes: any[];
  vehicles: any[];
  zones: any[];
}) {
  const { data, total } = await getFuelDispenses({
    from,
    to,
    page,
    fuelTypeId: fuelTypeId || undefined,
    vehicleId: vehicleId || undefined,
    zoneId: zoneId || undefined,
  });

  return (
    <FuelDispenseList
      dispenses={data as FuelDispenseRow[]}
      total={total}
      page={page}
      pageSize={20}
      fuelTypes={fuelTypes}
      vehicles={vehicles}
      zones={zones}
      filters={{ from, to, vehicleId, zoneId, fuelTypeId }}
    />
  );
}

async function ReceiptsTabContent({
  from,
  to,
  page,
  fuelTypeId,
  fuelTypes,
  suppliers,
}: {
  from: string;
  to: string;
  page: number;
  fuelTypeId: string;
  fuelTypes: any[];
  suppliers: any[];
}) {
  const { data, total } = await getFuelReceipts({
    from,
    to,
    page,
    fuelTypeId: fuelTypeId || undefined,
  });

  return (
    <FuelReceiptList
      receipts={data as FuelReceiptRow[]}
      total={total}
      page={page}
      pageSize={20}
      fuelTypes={fuelTypes}
      suppliers={suppliers}
      filters={{ from, to, fuelTypeId }}
    />
  );
}

async function ReportsTabContent({
  from,
  to,
  vehicleId,
  zoneId,
  fuelTypes,
  vehicles,
  zones,
}: {
  from: string;
  to: string;
  vehicleId: string;
  zoneId: string;
  fuelTypes: any[];
  vehicles: any[];
  zones: any[];
}) {
  const reportData = await getFuelReportData({
    from,
    to,
    vehicleId: vehicleId || undefined,
    zoneId: zoneId || undefined,
  });

  return (
    <FuelReports
      reportData={reportData}
      vehicles={vehicles}
      zones={zones}
      fuelTypes={fuelTypes}
      filters={{ from, to, vehicleId, zoneId }}
    />
  );
}
