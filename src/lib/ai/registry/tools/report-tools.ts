import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AIUserContext } from "../index";

const VALID_STATUSES = ["draft", "pending", "approved", "rejected", "received", "issued", "cancelled"] as const;
type RequisitionStatus = (typeof VALID_STATUSES)[number];

function checkPrivilege(ctx: any) {
  const role = ctx?.userContext?.role || "requester";
  const isPrivileged = ["owner", "accountant", "warehouse", "superuser"].includes(role);
  if (!isPrivileged) throw new Error("Unauthorized tool execution: Requires privileged role.");
}

export const reportTools = {
  get_recent_requisitions: tool({
    description: "Tra cứu danh sách các phiếu xin cấp phát vật tư gần đây và trạng thái phê duyệt.",
    parameters: z.object({
      status: z.string().optional().default("all").describe("Trạng thái phiếu ('all', 'pending', 'approved',...)"),
      limit: z.number().optional().default(6).describe("Số lượng phiếu cần lấy"),
    }).passthrough(),
    execute: async (rawArgs: { status?: string; limit?: number }, ctx: any) => {
      try {
        checkPrivilege(ctx);
        const status = rawArgs.status || "all";
        const limit = typeof rawArgs.limit === "number" ? rawArgs.limit : 6;

        const supabase = createAdminClient();
        let query = supabase
          .from("requisitions")
          .select("id, code, status, purpose, created_at, profiles!requisitions_requester_id_fkey(name), zones(name)")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (status && status !== "all" && VALID_STATUSES.includes(status as RequisitionStatus)) {
          query = query.eq("status", status as RequisitionStatus);
        }

        const { data, error } = await query;
        if (error) {
          return { error: error.message };
        }

        return (data || []).map((r) => ({
          code: r.code,
          status: r.status,
          requester: (r.profiles as unknown as { name: string })?.name || "N/A",
          zone: (r.zones as unknown as { name: string })?.name || "Khu chung",
          purpose: r.purpose || "Cấp phát vật tư",
          createdAt: new Date(r.created_at).toLocaleDateString("vi-VN"),
        }));
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Lỗi tra cứu phiếu cấp phát" };
      }
    },
  }),

  get_recent_defects: tool({
    description: "Tra cứu danh sách phiếu báo hỏng vật tư và tình trạng đổi 1-1 / sửa chữa.",
    parameters: z.object({
      limit: z.number().optional().default(6).describe("Số lượng phiếu cần lấy"),
    }).passthrough(),
    execute: async (rawArgs: { limit?: number }, ctx: any) => {
      try {
        checkPrivilege(ctx);
        const limit = typeof rawArgs.limit === "number" ? rawArgs.limit : 6;
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from("defect_notes")
          .select("id, code, status, created_at, zones(name), defect_note_items(id, reason, status)")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          return { error: error.message };
        }

        return (data || []).map((d) => ({
          code: d.code,
          status: d.status,
          zone: (d.zones as unknown as { name: string })?.name || "Khu chung",
          totalItems: d.defect_note_items?.length || 0,
          createdAt: new Date(d.created_at).toLocaleDateString("vi-VN"),
        }));
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Lỗi tra cứu phiếu báo hỏng" };
      }
    },
  }),
};
