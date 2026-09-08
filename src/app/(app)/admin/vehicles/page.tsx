import { VehicleList, type VehicleListRow } from "@/features/vehicles/components/vehicle-list";
import { VEHICLE_TYPE_LABELS } from "@/features/vehicles/schema";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }>;
}) {
  await requireManager();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const type = sp.type && sp.type in VEHICLE_TYPE_LABELS ? sp.type : "";
  const status = sp.status === "active" || sp.status === "inactive" ? sp.status : "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const supabase = await createClient();

  let vehiclesQuery = supabase
    .from("vehicles")
    .select("id, code, name, type, zone_id, default_driver, fuel_type_id, current_odo, odo_unit, fuel_norm, qr_token, notes, is_active, zone:zones!vehicles_zone_id_fkey(name), fuel_type:fuel_types!vehicles_fuel_type_id_fkey(name)", { count: "exact" })
    .order("code")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) vehiclesQuery = vehiclesQuery.or(`code.ilike.%${q}%,name.ilike.%${q}%,default_driver.ilike.%${q}%`);
  if (type) vehiclesQuery = vehiclesQuery.eq("type", type as "other" | "truck" | "excavator" | "generator" | "car" | "forklift" | "tractor");
  if (status) vehiclesQuery = vehiclesQuery.eq("is_active", status === "active");

  const [vehiclesResult, fuelTypesResult, zonesResult] = await Promise.all([
    vehiclesQuery,
    supabase.from("fuel_types").select("id, name").eq("is_active", true).order("name"),
    supabase.from("zones").select("id, name").is("deleted_at", null).order("name"),
  ]);

  if (vehiclesResult.error) throw new Error(`Không thể tải danh sách phương tiện: ${vehiclesResult.error.message}`);
  if (fuelTypesResult.error) throw new Error(`Không thể tải loại nhiên liệu: ${fuelTypesResult.error.message}`);
  if (zonesResult.error) throw new Error(`Không thể tải khu vực: ${zonesResult.error.message}`);

  const rows: VehicleListRow[] = (vehiclesResult.data ?? []).map((vehicle) => ({
    id: vehicle.id,
    code: vehicle.code,
    name: vehicle.name,
    type: vehicle.type,
    zoneId: vehicle.zone_id,
    zoneName: vehicle.zone?.name ?? null,
    defaultDriver: vehicle.default_driver,
    fuelTypeId: vehicle.fuel_type_id,
    fuelTypeName: vehicle.fuel_type?.name ?? null,
    currentOdo: Number(vehicle.current_odo),
    odoUnit: vehicle.odo_unit,
    fuelNorm: vehicle.fuel_norm == null ? null : Number(vehicle.fuel_norm),
    qrToken: vehicle.qr_token,
    notes: vehicle.notes,
    isActive: vehicle.is_active,
  }));

  return (
    <VehicleList
      vehicles={rows}
      fuelTypes={fuelTypesResult.data ?? []}
      zones={zonesResult.data ?? []}
      page={page}
      totalPages={Math.max(1, Math.ceil((vehiclesResult.count ?? 0) / PAGE_SIZE))}
      filters={{ q, type, status }}
    />
  );
}
