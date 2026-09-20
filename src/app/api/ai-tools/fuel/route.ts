import { NextRequest, NextResponse } from "next/server";
import { verifyToolsAuth } from "@/lib/ai/tools-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  if (!verifyToolsAuth(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing X-MTP-AI-SECRET header." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "dispense_report";
  const startDate = searchParams.get("startDate") || searchParams.get("start_date") || "";
  const endDate = searchParams.get("endDate") || searchParams.get("end_date") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

  try {
    const supabase = createAdminClient();

    if (action === "vehicles") {
      const { data: vehicles, error } = await supabase
        .from("vehicles")
        .select("id, code, name, type, fuel_norm, odo_unit, current_odo, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({
        success: true,
        total: vehicles?.length || 0,
        vehicles: (vehicles || []).map((v) => ({
          code: v.code,
          name: v.name,
          type: v.type,
          current_meter: `${v.current_odo} ${v.odo_unit === "km" ? "km" : "giờ"}`,
          fuel_norm: v.fuel_norm ? `${v.fuel_norm} L/${v.odo_unit === "km" ? "100km" : "h"}` : "Chưa đặt",
        })),
      });
    }

    const rpcClient = supabase as unknown as {
      rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: any[] | null; error: Error | null }>;
    };

    const { data, error } = await rpcClient.rpc("ai_get_fuel_summary", {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: limit,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const records = data || [];
    const totalLiters = records.reduce((acc: number, cur) => acc + Number(cur.quantity || 0), 0);

    return NextResponse.json({
      success: true,
      total_dispenses: records.length,
      total_liters: totalLiters,
      records: records.map((r) => ({
        code: r.dispense_code,
        date: r.dispense_date ? new Date(r.dispense_date).toLocaleDateString("vi-VN") : "N/A",
        vehicle: `${r.vehicle_name} (${r.vehicle_code})`,
        fuel_type: r.fuel_type_name,
        quantity_liters: Number(r.quantity),
        driver: r.driver_name,
        notes: r.notes || "",
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
