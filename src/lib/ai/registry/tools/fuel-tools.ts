import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

interface FuelSummaryRow {
  dispense_id: string;
  dispense_code: string;
  dispense_date: string;
  vehicle_name: string;
  vehicle_code: string;
  fuel_type_name: string;
  quantity: number | string;
  driver_name: string;
  notes: string;
}

function checkPrivilege(ctx: any) {
  const role = ctx?.userContext?.role || "requester";
  const isPrivileged = ["owner", "accountant", "warehouse", "superuser"].includes(role);
  if (!isPrivileged) throw new Error("Unauthorized tool execution: Requires privileged role.");
}

export const fuelTools = {
  get_fuel_dispense_report: tool({
    description: "Tra cứu lịch sử và báo cáo cấp phát nhiên liệu (Xăng, Dầu Diesel) theo khoảng ngày hoặc phương tiện.",
    parameters: z.object({
      startDate: z.string().optional().describe("Ngày bắt đầu định dạng YYYY-MM-DD"),
      endDate: z.string().optional().describe("Ngày kết thúc định dạng YYYY-MM-DD"),
      start_date: z.string().optional().describe("Ngày bắt đầu thay thế"),
      end_date: z.string().optional().describe("Ngày kết thúc thay thế"),
      limit: z.number().optional().default(10),
    }).passthrough(),
    execute: async (rawArgs: { startDate?: string; endDate?: string; start_date?: string; end_date?: string; limit?: number }, ctx: any) => {
      try {
        checkPrivilege(ctx);
        const startDate = (rawArgs.startDate || rawArgs.start_date || "").trim();
        const endDate = (rawArgs.endDate || rawArgs.end_date || "").trim();
        const limit = typeof rawArgs.limit === "number" ? rawArgs.limit : 10;

        const supabase = createAdminClient();
        const rpcClient = supabase as unknown as {
          rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: FuelSummaryRow[] | null; error: Error | null }>;
        };

        const { data, error } = await rpcClient.rpc("ai_get_fuel_summary", {
          p_start_date: startDate || null,
          p_end_date: endDate || null,
          p_limit: limit,
        });

        if (error) {
          return { error: error.message };
        }

        const records = data || [];
        const totalLiters = records.reduce((acc: number, cur) => acc + Number(cur.quantity || 0), 0);

        return {
          totalDispenses: records.length,
          totalLiters,
          records: records.map((r) => ({
            code: r.dispense_code,
            date: r.dispense_date ? new Date(r.dispense_date).toLocaleDateString("vi-VN") : "N/A",
            vehicle: `${r.vehicle_name} (${r.vehicle_code})`,
            fuelType: r.fuel_type_name,
            quantityLiters: Number(r.quantity),
            driver: r.driver_name,
            notes: r.notes,
          })),
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Lỗi tra cứu báo cáo xăng dầu" };
      }
    },
  }),

  get_vehicles_list: tool({
    description: "Tra cứu danh sách xe, máy phát điện, máy xúc và định mức tiêu hao nhiên liệu hiện tại.",
    parameters: z.object({}).passthrough(),
    execute: async (_args: any, ctx: any) => {
      try {
        checkPrivilege(ctx);
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from("vehicles")
          .select("id, code, name, type, default_driver, current_odo, odo_unit, fuel_norm, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) {
          return { error: error.message };
        }

        return (data || []).map((v) => ({
          code: v.code,
          name: v.name,
          type: v.type,
          driver: v.default_driver || "Chưa gán",
          currentOdo: `${v.current_odo} ${v.odo_unit}`,
          norm: v.fuel_norm ? `${v.fuel_norm} L/${v.odo_unit}` : "Không có định mức",
        }));
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Lỗi tra cứu danh sách xe" };
      }
    },
  }),
};
