import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

import { inventoryTools } from "./registry/tools/inventory-tools";
import { fuelTools } from "./registry/tools/fuel-tools";
import { sopTools } from "./registry/tools/sop-tools";
import { actionTools } from "./registry/tools/action-tools";
import { getRegisteredTools } from "./registry";

type ToolExec<TInput, TOutput> = {
  execute: (input: TInput, ctx?: any) => Promise<TOutput>;
};

const adminCtx = { userContext: { role: "superuser" } };

describe("AI Agent & Tools Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should query stock summary via get_stock_balance tool", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          product_name: "Động cơ điện 3 pha",
          category_name: "Điện - Điện tử",
          attributes: { "Công suất": "1.5kW" },
          unit: "Cái",
          total_stock: 12,
          min_stock: 4,
          location_details: "Kho chính: 12 Cái",
        },
      ],
      error: null,
    });

    const tool = inventoryTools.get_stock_balance as unknown as ToolExec<{ searchTerm: string; limit?: number }, { productName: string; totalStock: number }[]>;
    const result = await tool.execute({
      searchTerm: "động cơ",
      limit: 3,
    }, adminCtx);

    expect(mockRpc).toHaveBeenCalledWith("ai_get_stock_summary", {
      p_query: "động cơ",
      p_limit: 3,
    });
    expect(result).toHaveLength(1);
    expect(result[0].productName).toBe("Động cơ điện 3 pha");
    expect(result[0].totalStock).toBe(12);
  });

  it("should query low stock alerts via get_low_stock_alerts tool", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          product_name: "Bóng sưởi 150W",
          category_name: "Điện",
          unit: "Bóng",
          total_stock: 2,
          min_stock: 10,
          location_details: "Kho chính: 2 Bóng",
        },
      ],
      error: null,
    });

    const tool = inventoryTools.get_low_stock_alerts as unknown as ToolExec<{ limit?: number }, { totalAlerts: number; items: { productName: string }[] }>;
    const result = await tool.execute({
      limit: 5,
    }, adminCtx);

    expect(result.totalAlerts).toBe(1);
    expect(result.items[0].productName).toBe("Bóng sưởi 150W");
  });

  it("should query fuel dispenses via get_fuel_dispense_report tool", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          dispense_code: "FD-001",
          dispense_date: "2026-09-10T08:00:00Z",
          vehicle_name: "Xe tải Isuzu",
          vehicle_code: "XE-01",
          fuel_type_name: "Dầu DO 0.05S",
          quantity: 50,
          driver_name: "Nguyễn Văn Lái",
          notes: "Chở cám trại 2",
        },
      ],
      error: null,
    });

    const tool = fuelTools.get_fuel_dispense_report as unknown as ToolExec<{ limit?: number }, { totalLiters: number; records: { vehicle: string }[] }>;
    const result = await tool.execute({
      limit: 3,
    }, adminCtx);

    expect(result.totalLiters).toBe(50);
    expect(result.records[0].vehicle).toBe("Xe tải Isuzu (XE-01)");
  });

  it("should search SOP knowledge base via search_sop_knowledge tool", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          chunk_id: "chunk-1",
          document_id: "doc-1",
          title: "📖 HƯỚNG DẪN 06: ĐỔI 1-1 CẤP TỐC",
          category: "sop",
          content: "Quy trình đổi 1-1 cho thiết bị hỏng tại trại...",
          rank: 0.85,
        },
      ],
      error: null,
    });

    const tool = sopTools.search_sop_knowledge as unknown as ToolExec<{ query: string }, { found: boolean; results: { title: string }[] }>;
    const result = await tool.execute({
      query: "đổi 1-1",
    }, adminCtx);

    expect(result.found).toBe(true);
    expect(result.results[0].title).toContain("ĐỔI 1-1");
  });

  it("should draft requisition payload via draft_requisition tool", async () => {
    const tool = actionTools.draft_requisition as unknown as ToolExec<
      { productName: string; quantity: number; unit?: string; targetZone?: string; reason: string },
      { action: string; draft: { productName: string; quantity: number } }
    >;
    const result = await tool.execute({
      productName: "Bạt che trại 4x50m",
      quantity: 5,
      unit: "Cuộn",
      targetZone: "Trại Gà Đẻ 02",
      reason: "Bạt cũ bị rách do gió lớn",
    }, adminCtx);

    expect(result.action).toBe("DRAFT_REQUISITION");
    expect(result.draft.quantity).toBe(5);
    expect(result.draft.productName).toBe("Bạt che trại 4x50m");
  });

  it("should clean natural language query and handle aliases in get_stock_balance", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          product_name: "Bạc đạn gối UCF",
          category_name: "Vòng bi - Bạc đạn",
          attributes: {},
          unit: "Cái",
          total_stock: 0,
          min_stock: 0,
          location_details: "Kho chính Minh Tân Phát: 0 Cái",
        },
      ],
      error: null,
    });

    const tool = inventoryTools.get_stock_balance as unknown as ToolExec<Record<string, unknown>, { productName: string }[]>;
    const result = await tool.execute({
      reason: "Tra cứu tồn kho thực tế của các loại bạc đạn ở các kho hiện tại.",
      limit: 10,
    }, adminCtx);

    expect(mockRpc).toHaveBeenCalledWith("ai_get_stock_summary", {
      p_query: "bạc đạn",
      p_limit: 10,
    });
    expect(result).toHaveLength(1);
    expect(result[0].productName).toBe("Bạc đạn gối UCF");
  });

  it("should split multi-term queries with conjunctions in get_stock_balance", async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: [
          {
            sku_id: "v-1",
            product_name: "Động cơ điện 1.5kW",
            category_name: "Điện",
            attributes: {},
            unit: "Cái",
            total_stock: 5,
            min_stock: 1,
            location_details: "Kho chính: 5 Cái",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            sku_id: "v-2",
            product_name: "Van bi đồng phi 27",
            category_name: "Cơ khí",
            attributes: {},
            unit: "Cái",
            total_stock: 10,
            min_stock: 2,
            location_details: "Kho chính: 10 Cái",
          },
        ],
        error: null,
      });

    const tool = inventoryTools.get_stock_balance as unknown as ToolExec<{ searchTerm: string; limit?: number }, { productName: string }[]>;
    const result = await tool.execute({
      searchTerm: "động cơ điện và van bi",
      limit: 10,
    }, adminCtx);

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenNthCalledWith(1, "ai_get_stock_summary", {
      p_query: "động cơ điện",
      p_limit: 5,
    });
    expect(mockRpc).toHaveBeenNthCalledWith(2, "ai_get_stock_summary", {
      p_query: "van bi",
      p_limit: 5,
    });
    expect(result).toHaveLength(2);
    expect(result[0].productName).toBe("Động cơ điện 1.5kW");
    expect(result[1].productName).toBe("Van bi đồng phi 27");
  });

  it("should enforce RBAC tool availability", () => {
    const requesterTools = getRegisteredTools({ userId: "1", role: "requester" }) as Record<string, unknown>;
    expect(requesterTools.get_stock_balance).toBeDefined();
    expect(requesterTools.get_fuel_dispense_report).toBeUndefined();

    const accountantTools = getRegisteredTools({ userId: "2", role: "accountant" }) as Record<string, unknown>;
    expect(accountantTools.get_fuel_dispense_report).toBeDefined();
    expect(accountantTools.get_recent_requisitions).toBeDefined();
  });
});
