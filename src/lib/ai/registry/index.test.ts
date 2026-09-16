import { describe, it, expect } from "vitest";
import { getRegisteredTools } from "./index";

describe("getRegisteredTools", () => {
  it("should return basic tools for requester", () => {
    const tools = getRegisteredTools("requester") as Record<string, unknown>;
    expect(tools.get_stock_balance).toBeDefined();
    expect(tools.search_sop_knowledge).toBeDefined();
    expect(tools.draft_requisition).toBeDefined();
    // Requesters should not have full fuel and detailed reports
    expect(tools.get_fuel_dispense_report).toBeUndefined();
  });

  it("should return all tools for warehouse/owner/accountant", () => {
    const tools = getRegisteredTools("warehouse") as Record<string, unknown>;
    expect(tools.get_stock_balance).toBeDefined();
    expect(tools.search_sop_knowledge).toBeDefined();
    expect(tools.get_fuel_dispense_report).toBeDefined();
    expect(tools.get_recent_requisitions).toBeDefined();
  });
});
