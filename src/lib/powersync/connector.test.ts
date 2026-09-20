import { describe, it, expect, vi, beforeEach } from "vitest";
import { MinhTanPhatPowerSyncConnector } from "./connector";
import { UpdateType } from "@powersync/web";

const mockGetSession = vi.fn();
const mockRefreshSession = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
    rpc: mockRpc,
  }),
}));

describe("MinhTanPhatPowerSyncConnector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchCredentials", () => {
    it("returns null if powersyncUrl is not provided", async () => {
      const connector = new MinhTanPhatPowerSyncConnector({ powersyncUrl: "" });
      const creds = await connector.fetchCredentials();
      expect(creds).toBeNull();
    });

    it("returns credentials when session is available", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: "jwt_token_123",
            user: { id: "user_456" },
          },
        },
        error: null,
      });

      const connector = new MinhTanPhatPowerSyncConnector({
        powersyncUrl: "http://127.0.0.1:8080",
      });
      const creds = await connector.fetchCredentials();

      expect(creds).toEqual({
        endpoint: "http://127.0.0.1:8080",
        token: "jwt_token_123",
      });
    });

    it("returns null if session is not found or error occurred", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: new Error("No session"),
      });

      const connector = new MinhTanPhatPowerSyncConnector({
        powersyncUrl: "http://127.0.0.1:8080",
      });
      const creds = await connector.fetchCredentials();
      expect(creds).toBeNull();
    });

    it("invalidates credentials by triggering supabase session refresh", async () => {
      const connector = new MinhTanPhatPowerSyncConnector();
      await connector.invalidateCredentials();
      expect(mockRefreshSession).toHaveBeenCalled();
    });
  });

  describe("uploadData", () => {
    it("completes immediately when there is no transaction", async () => {
      const connector = new MinhTanPhatPowerSyncConnector();
      const mockDb = {
        getNextCrudTransaction: vi.fn().mockResolvedValue(null),
      };

      await connector.uploadData(mockDb as any);
      expect(mockDb.getNextCrudTransaction).toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("processes requisition upload using create_requisition RPC", async () => {
      const mockComplete = vi.fn().mockResolvedValue(undefined);
      mockRpc.mockResolvedValueOnce({ data: "req_123", error: null });

      const connector = new MinhTanPhatPowerSyncConnector();
      const mockDb = {
        getNextCrudTransaction: vi.fn().mockResolvedValue({
          crud: [
            {
              table: "requisitions",
              op: UpdateType.PUT,
              opData: {
                purpose: "Vật tư sửa quạt",
                zone_id: "zone_1",
                requester_id: "user_1",
                items: [
                  { sku_id: "sku_1", entered_quantity: 2 },
                ],
              },
            },
          ],
          complete: mockComplete,
        }),
      };

      await connector.uploadData(mockDb as any);

      expect(mockRpc).toHaveBeenCalledWith("create_requisition", expect.objectContaining({
        p_purpose: "Vật tư sửa quạt",
        p_zone_id: "zone_1",
        p_requester_id: "user_1",
        p_items: [{ sku_id: "sku_1", transaction_unit_id: null, entered_quantity: 2 }],
      }));
      expect(mockComplete).toHaveBeenCalled();
    });

    it("processes fuel dispense upload using create_fuel_dispense RPC", async () => {
      const mockComplete = vi.fn().mockResolvedValue(undefined);
      mockRpc.mockResolvedValueOnce({ data: "fuel_123", error: null });

      const connector = new MinhTanPhatPowerSyncConnector();
      const mockDb = {
        getNextCrudTransaction: vi.fn().mockResolvedValue({
          crud: [
            {
              table: "fuel_dispenses",
              op: UpdateType.PUT,
              opData: {
                vehicle_id: "veh_1",
                fuel_type_id: "fuel_1",
                quantity: 50,
                dispenser_id: "user_1",
              },
            },
          ],
          complete: mockComplete,
        }),
      };

      await connector.uploadData(mockDb as any);

      expect(mockRpc).toHaveBeenCalledWith("create_fuel_dispense", expect.objectContaining({
        p_vehicle_id: "veh_1",
        p_fuel_type_id: "fuel_1",
        p_quantity: 50,
        p_by: "user_1",
      }));
      expect(mockComplete).toHaveBeenCalled();
    });
  });
});
