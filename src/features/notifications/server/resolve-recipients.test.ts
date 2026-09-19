import { describe, it, expect, vi } from "vitest";
import { resolveRecipients } from "./resolve-recipients";
import { getEventPolicy } from "./policies";
import type { Role } from "@/lib/types";

describe("resolveRecipients", () => {
  const mockProfiles = [
    { id: "usr-admin", email: "admin@mtp.vn", name: "Super User", role: "superuser" as Role, is_active: true },
    { id: "usr-owner", email: "owner@mtp.vn", name: "Chủ Trại", role: "owner" as Role, is_active: true },
    { id: "usr-accountant", email: "acct@mtp.vn", name: "Kế Toán", role: "accountant" as Role, is_active: true },
    { id: "usr-warehouse-1", email: "wh1@mtp.vn", name: "Thủ Kho 1", role: "warehouse" as Role, is_active: true },
    { id: "usr-warehouse-2", email: "wh2@mtp.vn", name: "Thủ Kho 2", role: "warehouse" as Role, is_active: true },
    { id: "usr-tech", email: "tech@mtp.vn", name: "Kỹ Thuật", role: "technician" as Role, is_active: true },
    { id: "usr-req1", email: "req1@mtp.vn", name: "Người Yêu Cầu 1", role: "requester" as Role, is_active: true },
    { id: "usr-req2-inactive", email: "req2@mtp.vn", name: "Người Yêu Cầu 2", role: "requester" as Role, is_active: false },
    { id: "usr-req3-local", email: "req3@mtp.local", name: "Người Yêu Cầu 3", role: "requester" as Role, is_active: true },
    { id: "usr-driver1", email: "driver1@mtp.vn", name: "Tài Xế 1", role: "driver" as Role, is_active: true },
    { id: "usr-driver2", email: "driver2@mtp.vn", name: "Tài Xế 2", role: "driver" as Role, is_active: true },
  ];

  function createMockSupabase(profiles = mockProfiles) {
    return {
      from: vi.fn((_table: string) => {
        return {
          select: vi.fn(() => ({
            or: vi.fn((condStr: string) => {
              // Parse PostgREST OR condition: e.g. "role.in.(accountant,owner),id.in.(...)"
              const matched = profiles.filter((p) => {
                let roleMatch = false;
                let idMatch = false;
                const roleInMatch = condStr.match(/role\.in\.\(([^)]+)\)/);
                if (roleInMatch) {
                  const roles = roleInMatch[1].split(",");
                  roleMatch = roles.includes(p.role);
                }
                const idInMatch = condStr.match(/id\.in\.\(([^)]+)\)/);
                if (idInMatch) {
                  const ids = idInMatch[1].split(",");
                  idMatch = ids.includes(p.id);
                }
                return roleMatch || idMatch;
              });
              return Promise.resolve({ data: matched, error: null });
            }),
            in: vi.fn((field: string, values: string[]) => {
              const matched = profiles.filter((p) => {
                if (field === "role") return values.includes(p.role);
                if (field === "id") return values.includes(p.id);
                return false;
              });
              return Promise.resolve({ data: matched, error: null });
            }),
          })),
        };
      }),
    } as any;
  }

  it("never includes superuser implicitly for business events", async () => {
    const policy = getEventPolicy("receipt.posted"); // targetRoles: ['warehouse', 'accountant', 'owner']
    const supabase = createMockSupabase();

    const result = await resolveRecipients({
      supabase,
      policy,
      actorId: "usr-warehouse-1",
      participants: {},
    });

    const recipientRoles = result.recipients.map((r) => r.role);
    expect(recipientRoles).not.toContain("superuser");
    expect(result.recipients.map((r) => r.id)).toEqual(
      expect.arrayContaining(["usr-owner", "usr-accountant", "usr-warehouse-2"])
    );
  });

  it("excludes actor from recipient list when excludeActor is true", async () => {
    const policy = getEventPolicy("receipt.posted"); // targets warehouse + accountant + owner
    const supabase = createMockSupabase();

    const result = await resolveRecipients({
      supabase,
      policy,
      actorId: "usr-owner", // Actor is the owner
      participants: {},
    });

    expect(result.recipients.map((r) => r.id)).toEqual(
      expect.arrayContaining(["usr-accountant", "usr-warehouse-1", "usr-warehouse-2"])
    );
    expect(result.recipients.map((r) => r.id)).not.toContain("usr-owner");
    expect(result.diagnostics.excludedActorIds).toContain("usr-owner");
  });

  it("multi-warehouse: when Warehouse Manager 1 inputs/outputs goods, Warehouse Manager 2 receives notification", async () => {
    const receiptPolicy = getEventPolicy("receipt.posted"); // targets warehouse + accountant + owner
    const supabase = createMockSupabase();

    const result = await resolveRecipients({
      supabase,
      policy: receiptPolicy,
      actorId: "usr-warehouse-1", // Warehouse Manager 1 performs receipt
      participants: {},
    });

    // Warehouse 1 is excluded, Warehouse 2 receives notification
    const recipientIds = result.recipients.map((r) => r.id);
    expect(recipientIds).not.toContain("usr-warehouse-1");
    expect(recipientIds).toContain("usr-warehouse-2");
    expect(recipientIds).toContain("usr-accountant");
    expect(recipientIds).toContain("usr-owner");
  });

  it("multi-warehouse: when Warehouse Manager 1 fulfills requisition, Warehouse Manager 2 and Requester receive notification", async () => {
    const fulfillPolicy = getEventPolicy("requisition.fulfilled"); // targets warehouse + requesterId
    const supabase = createMockSupabase();

    const result = await resolveRecipients({
      supabase,
      policy: fulfillPolicy,
      actorId: "usr-warehouse-1", // Warehouse Manager 1 fulfills
      participants: { requesterId: "usr-req1" },
    });

    const recipientIds = result.recipients.map((r) => r.id);
    expect(recipientIds).not.toContain("usr-warehouse-1");
    expect(recipientIds).toContain("usr-warehouse-2");
    expect(recipientIds).toContain("usr-req1");
  });

  it("filters out inactive users and @mtp.local placeholder emails", async () => {
    const policy = getEventPolicy("requisition.approved"); // targetParticipants: ['requesterId'], targetRoles: ['warehouse']
    const supabase = createMockSupabase();

    // Passing inactive requester
    const resultInactive = await resolveRecipients({
      supabase,
      policy,
      actorId: "usr-owner",
      participants: { requesterId: "usr-req2-inactive" },
    });
    expect(resultInactive.recipients.map((r) => r.id)).not.toContain("usr-req2-inactive");
    expect(resultInactive.diagnostics.inactiveIds).toContain("usr-req2-inactive");

    // Passing local email requester
    const resultLocal = await resolveRecipients({
      supabase,
      policy,
      actorId: "usr-owner",
      participants: { requesterId: "usr-req3-local" },
    });
    expect(resultLocal.recipients.map((r) => r.id)).not.toContain("usr-req3-local");
    expect(resultLocal.diagnostics.invalidEmailIds).toContain("usr-req3-local");
  });

  it("routes fuel dispense direct email to driver and other warehouse managers", async () => {
    const policy = getEventPolicy("fuel.dispensed"); // targetRoles: ['warehouse'], targetParticipants: ['driverId']
    const supabase = createMockSupabase();

    const result = await resolveRecipients({
      supabase,
      policy,
      actorId: "usr-warehouse-1",
      participants: { driverId: "usr-driver1" },
    });

    expect(result.recipients.map((r) => r.id)).toEqual(
      expect.arrayContaining(["usr-driver1", "usr-warehouse-2"])
    );
    expect(result.recipients.map((r) => r.id)).not.toContain("usr-warehouse-1");
    expect(result.recipients.map((r) => r.id)).not.toContain("usr-driver2");
  });

  it("deduplicates recipients if a user matches both role and participant", async () => {
    const policy = getEventPolicy("requisition.approved"); // role: warehouse, participant: requester
    // If warehouse user is also passed as requesterId
    const supabase = createMockSupabase();

    const result = await resolveRecipients({
      supabase,
      policy,
      actorId: "usr-owner",
      participants: { requesterId: "usr-warehouse-1" },
    });

    const whRecipients = result.recipients.filter((r) => r.id === "usr-warehouse-1");
    expect(whRecipients.length).toBe(1);
  });
});
