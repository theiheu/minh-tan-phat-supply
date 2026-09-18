import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn()
}));

import { getRegisteredTools } from "@/lib/ai/registry/index";
import { fuelTools } from "@/lib/ai/registry/tools/fuel-tools";

describe("AI Registry Tools Security (WP-11)", () => {
  it("getRegisteredTools cấp đúng tools theo role", () => {
    const unprivileged = getRegisteredTools({ userId: "1", role: "requester" });
    expect(unprivileged).not.toHaveProperty("get_fuel_dispense_report");
    expect(unprivileged).toHaveProperty("search_sop_knowledge");

    const privileged = getRegisteredTools({ userId: "2", role: "warehouse" });
    expect(privileged).toHaveProperty("get_fuel_dispense_report");
  });

  it("fuelTools từ chối thực thi khi không có quyền (Context bypass attempt)", async () => {
    const ctx = { userContext: { userId: "hacker", role: "requester" } };
    
    // @ts-ignore
    const result = await fuelTools.get_fuel_dispense_report.execute({ startDate: "2024-01-01" }, ctx);
    expect(result).toHaveProperty("error");
    expect(result.error).toContain("Unauthorized");
  });
});
