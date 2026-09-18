import { describe, it, expect } from "vitest";
import { getRegisteredTools } from "./index";

describe("getRegisteredTools", () => {
  it("should return basic tools for requester", () => {
    const tools = getRegisteredTools({ userId: "1", role: "requester" });
    expect(tools).toHaveProperty("get_stock_balance");
    expect(tools).toHaveProperty("search_sop_knowledge");
    expect(tools).toHaveProperty("draft_requisition");
    expect(tools).not.toHaveProperty("get_fuel_dispense_report");
  });

  it("should return all tools for warehouse/owner/accountant", () => {
    const roles = ["warehouse", "owner", "accountant", "superuser"];

    roles.forEach((role) => {
      const tools = getRegisteredTools({ userId: "x", role });
      expect(tools).toHaveProperty("get_fuel_dispense_report");
      expect(tools).toHaveProperty("get_recent_requisitions");
      expect(tools).toHaveProperty("get_stock_balance");
    });
  });
});
