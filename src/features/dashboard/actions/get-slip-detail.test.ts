import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSlipDetail } from "./get-slip-detail";

const mockGetCurrentProfile = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentProfile: () => mockGetCurrentProfile(),
}));

const mockFrom = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockAdminFrom,
  })),
}));

describe("getSlipDetail - Requisition Timeline & Account Display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentProfile.mockResolvedValue({
      id: "user-creator",
      role: "warehouse",
      name: "Quản Kho A",
    });
  });

  it("displays creator name on create step and beneficiary (requester) name on submit step when created on behalf of someone else", async () => {
    // Mock audit logs
    const mockAuditLogs = [
      {
        id: "audit-1",
        action: "requisition.create",
        created_at: "2026-09-19T08:00:00Z",
        actor: { name: "Quản Kho A" }, // Người tạo hộ
      },
      {
        id: "audit-2",
        action: "requisition.submit",
        created_at: "2026-09-19T08:01:00Z",
        actor: { name: "Quản Kho A" }, // Hệ thống ghi nhận actor_id là Quản Kho A lúc submit
      },
      {
        id: "audit-3",
        action: "requisition.approve",
        created_at: "2026-09-19T09:00:00Z",
        actor: { name: "Ban Giám Đốc" },
      },
      {
        id: "audit-4",
        action: "requisition.fulfill",
        created_at: "2026-09-19T10:00:00Z",
        actor: { name: "Thủ Kho B" },
      },
      {
        id: "audit-5",
        action: "requisition.receive",
        created_at: "2026-09-19T11:00:00Z",
        actor: { name: "Công Nhân C" },
      },
    ];

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "audit_logs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockAuditLogs, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "requisitions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "req-123",
                  code: "REQ-0001",
                  status: "received",
                  requester_id: "worker-c",
                  created_at: "2026-09-19T08:00:00Z",
                  approved_at: "2026-09-19T09:00:00Z",
                  fulfilled_at: "2026-09-19T10:00:00Z",
                  received_at: "2026-09-19T11:00:00Z",
                  requester: { name: "Công Nhân C" }, // Người được tạo hộ phiếu
                  approver: { name: "Ban Giám Đốc" },
                  fulfiller: { name: "Thủ Kho B" },
                  receiver: { name: "Công Nhân C" },
                  items: [],
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "requisition_returns") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          contains: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    const result = await getSlipDetail("requisition", "req-123");
    expect(result.error).toBeUndefined();
    expect(result.detail).not.toBeNull();

    const timeline = result.detail?.timeline;
    expect(timeline).toBeDefined();
    expect(timeline?.length).toBe(5);

    // 1. Tiến trình tạo phiếu: Tên tài khoản tạo phiếu (Quản Kho A)
    const createEvent = timeline?.find((e) => e.key === "requisition.create");
    expect(createEvent).toBeDefined();
    expect(createEvent?.by).toBe("Quản Kho A");

    // 2. Tiến trình gửi phiếu yêu cầu: Tên tài khoản được tạo hộ phiếu (Công Nhân C)
    const submitEvent = timeline?.find((e) => e.key === "requisition.submit");
    expect(submitEvent).toBeDefined();
    expect(submitEvent?.by).toBe("Công Nhân C");

    // 3. Tiến trình duyệt phiếu: Tên tài khoản duyệt (Ban Giám Đốc)
    const approveEvent = timeline?.find((e) => e.key === "requisition.approve");
    expect(approveEvent?.by).toBe("Ban Giám Đốc");

    // 4. Tiến trình cấp phát: Tên tài khoản cấp phát (Thủ Kho B)
    const fulfillEvent = timeline?.find((e) => e.key === "requisition.fulfill");
    expect(fulfillEvent?.by).toBe("Thủ Kho B");

    // 5. Tiến trình xác nhận nhận: Tên tài khoản nhận (Công Nhân C)
    const receiveEvent = timeline?.find((e) => e.key === "requisition.receive");
    expect(receiveEvent?.by).toBe("Công Nhân C");
  });

  it("displays requester name on both create and submit when creating for themselves", async () => {
    const mockAuditLogs = [
      {
        id: "audit-1",
        action: "requisition.create",
        created_at: "2026-09-19T08:00:00Z",
        actor: { name: "Công Nhân C" },
      },
      {
        id: "audit-2",
        action: "requisition.submit",
        created_at: "2026-09-19T08:01:00Z",
        actor: { name: "Công Nhân C" },
      },
    ];

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "audit_logs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockAuditLogs, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "requisitions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "req-456",
                  code: "REQ-0002",
                  status: "pending",
                  requester_id: "worker-c",
                  created_at: "2026-09-19T08:00:00Z",
                  requester: { name: "Công Nhân C" },
                  items: [],
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "requisition_returns") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          contains: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    const result = await getSlipDetail("requisition", "req-456");
    const timeline = result.detail?.timeline;

    expect(timeline?.find((e) => e.key === "requisition.create")?.by).toBe("Công Nhân C");
    expect(timeline?.find((e) => e.key === "requisition.submit")?.by).toBe("Công Nhân C");
  });
});
