import { describe, it, expect } from "vitest";
import { BUSINESS_EVENT_KEYS, getEventPolicy, type BusinessEventKey } from "./policies";

describe("Business Event Policies Registry", () => {
  it("defines all canonical business event keys without missing any", () => {
    const expectedKeys: BusinessEventKey[] = [
      "requisition.submitted",
      "requisition.approved",
      "requisition.rejected",
      "requisition.fulfilled",
      "requisition.cancelled",
      "requisition.received",
      "requisition.returned",
      "receipt.posted",
      "receipt.cancelled_or_reversed",
      "issue.sale_posted",
      "issue.internal_action_required",
      "liquidation.approved",
      "liquidation.completed",
      "liquidation.rejected",
      "stocktake.posted_with_variance",
      "stocktake.posted_without_variance",
      "stocktake.completed_discrepancy",
      "defect.created",
      "defect.resolution_selected",
      "defect.sent_to_liquidation",
      "repair.sent",
      "repair.ready_for_acceptance",
      "repair.accepted_and_returned",
      "repair.completed",
      "tool.borrowed",
      "tool.due_soon",
      "tool.overdue_started",
      "tool.returned",
      "tool.cancelled",
      "fuel.receipt_completed",
      "fuel.receipt_cancelled",
      "fuel.dispensed",
      "fuel.dispense_cancelled_or_adjusted",
      "exchange.created",
      "exchange.approved",
      "exchange.rejected",
      "exchange.issued",
      "exchange.received",
    ];

    expect(BUSINESS_EVENT_KEYS.sort()).toEqual(expectedKeys.sort());
  });

  describe("Role matrix and permissions", () => {
    it("never includes superuser in standard business event target roles", () => {
      for (const key of BUSINESS_EVENT_KEYS) {
        const policy = getEventPolicy(key);
        expect(policy.targetRoles).not.toContain("superuser");
      }
    });

    it("routes requester confirmation actions (submit, receive, return) to warehouse managers", () => {
      const reqSubmitted = getEventPolicy("requisition.submitted");
      expect(reqSubmitted.targetRoles).toContain("warehouse");
      expect(reqSubmitted.templateKind).toBe("action");

      const reqReceived = getEventPolicy("requisition.received");
      expect(reqReceived.targetRoles).toContain("warehouse");
      expect(reqReceived.templateKind).toBe("result");

      const reqReturned = getEventPolicy("requisition.returned");
      expect(reqReturned.targetRoles).toContain("warehouse");

      const toolReturned = getEventPolicy("tool.returned");
      expect(toolReturned.targetRoles).toContain("warehouse");

      const exchangeReceived = getEventPolicy("exchange.received");
      expect(exchangeReceived.targetRoles).toContain("warehouse");
    });

    it("routes warehouse goods operations (receipt, issue, fuel, stocktake) to all warehouse managers for multi-warehouse synchronization", () => {
      const receiptPosted = getEventPolicy("receipt.posted");
      expect(receiptPosted.targetRoles).toContain("warehouse");

      const issueSale = getEventPolicy("issue.sale_posted");
      expect(issueSale.targetRoles).toContain("warehouse");

      const reqFulfilled = getEventPolicy("requisition.fulfilled");
      expect(reqFulfilled.targetRoles).toContain("warehouse");

      const fuelReceipt = getEventPolicy("fuel.receipt_completed");
      expect(fuelReceipt.targetRoles).toContain("warehouse");

      const stocktakePosted = getEventPolicy("stocktake.posted_with_variance");
      expect(stocktakePosted.targetRoles).toContain("warehouse");
    });

    it("only grants financial permissions to accountant and owner events", () => {
      const financeKeys: BusinessEventKey[] = [
        "receipt.posted",
        "receipt.cancelled_or_reversed",
        "issue.sale_posted",
        "liquidation.completed",
        "stocktake.posted_with_variance",
        "stocktake.completed_discrepancy",
        "fuel.receipt_completed",
        "fuel.receipt_cancelled",
      ];

      for (const key of BUSINESS_EVENT_KEYS) {
        const policy = getEventPolicy(key);
        if (financeKeys.includes(key)) {
          expect(policy.templateKind).toBe("finance");
          expect(policy.allowsFinancialData).toBe(true);
          expect(policy.targetRoles).toEqual(expect.arrayContaining(["accountant", "owner"]));
        } else {
          expect(policy.allowsFinancialData).toBe(false);
          expect(policy.templateKind).not.toBe("finance");
        }
      }
    });

    it("routes driver events to driver participant and warehouse managers", () => {
      const driverKeys: BusinessEventKey[] = [
        "fuel.dispensed",
        "fuel.dispense_cancelled_or_adjusted",
      ];

      for (const key of driverKeys) {
        const policy = getEventPolicy(key);
        expect(policy.templateKind).toBe("driver");
        expect(policy.targetRoles).toContain("warehouse");
        expect(policy.targetParticipants).toEqual(["driverId"]);
      }
    });

    it("handles tool reminder policies and actor exclusion appropriately", () => {
      const dueSoonPolicy = getEventPolicy("tool.due_soon");
      expect(dueSoonPolicy.templateKind).toBe("action");
      expect(dueSoonPolicy.targetParticipants).toEqual(["borrowerId"]);
      expect(dueSoonPolicy.excludeActor).toBe(false); // System scheduler trigger

      const overduePolicy = getEventPolicy("tool.overdue_started");
      expect(overduePolicy.templateKind).toBe("action");
      expect(overduePolicy.targetRoles).toEqual(["warehouse"]);
      expect(overduePolicy.targetParticipants).toEqual(["borrowerId"]);
      expect(overduePolicy.excludeActor).toBe(false);
    });

    it("generates correct link paths using subject details", () => {
      const reqPolicy = getEventPolicy("requisition.approved");
      expect(reqPolicy.getLink({ type: "requisition", id: "req-123" })).toBe("/requisitions/req-123");

      const defectPolicy = getEventPolicy("defect.created");
      expect(defectPolicy.getLink({ type: "defect", id: "def-456" })).toBe("/defects");

      const fuelPolicy = getEventPolicy("fuel.dispensed");
      expect(fuelPolicy.getLink({ type: "fuel_dispense", id: "fuel-789" })).toBe("/fuel");
    });
  });
});
