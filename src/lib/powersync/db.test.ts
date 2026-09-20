import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

vi.mock("@powersync/web", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@powersync/web")>();
  return {
    ...actual,
    PowerSyncDatabase: class MockPowerSyncDatabase {
      connected = false;
      connect = mockConnect.mockImplementation(async () => {
        this.connected = true;
      });
      disconnect = mockDisconnect.mockImplementation(async () => {
        this.connected = false;
      });
    },
  };
});

import {
  getPowerSyncDatabase,
  getPowerSyncConnector,
  connectPowerSync,
  disconnectPowerSync,
  initPowerSync,
} from "./db";

describe("PowerSync DB Lifecycle & Auth Connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getPowerSyncDatabase returns database singleton on client", () => {
    const db = getPowerSyncDatabase();
    expect(db).toBeDefined();
    expect(getPowerSyncDatabase()).toBe(db);
  });

  it("getPowerSyncConnector returns connector singleton and updates URL if specified", () => {
    const conn1 = getPowerSyncConnector({ powersyncUrl: "http://127.0.0.1:8080" });
    expect(conn1.getPowersyncUrl()).toBe("http://127.0.0.1:8080");

    const conn2 = getPowerSyncConnector({ powersyncUrl: "http://127.0.0.1:9090" });
    expect(conn2.getPowersyncUrl()).toBe("http://127.0.0.1:9090");
    expect(conn1).toBe(conn2);
  });

  it("does NOT connect if powersyncUrl is not configured", async () => {
    getPowerSyncConnector({ powersyncUrl: "" });
    const connected = await connectPowerSync({ powersyncUrl: "" });
    expect(connected).toBe(false);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("does NOT connect if user is not signed in (no session / token)", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const connected = await connectPowerSync({ powersyncUrl: "http://127.0.0.1:8080" });
    expect(connected).toBe(false);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("connects successfully when user is authenticated with a valid session", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "mock_jwt_token_xyz",
          user: { id: "user_123" },
        },
      },
      error: null,
    });

    const connected = await connectPowerSync({ powersyncUrl: "http://127.0.0.1:8080" });
    expect(connected).toBe(true);
    expect(mockConnect).toHaveBeenCalled();
  });

  it("disconnectPowerSync calls db.disconnect when database is connected", async () => {
    const db = getPowerSyncDatabase();
    if (db) (db as any).connected = true;

    await disconnectPowerSync();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("initPowerSync returns db instance without throwing when unauthenticated", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const db = await initPowerSync({ powersyncUrl: "" });
    expect(db).toBeDefined();
    expect(mockConnect).not.toHaveBeenCalled();
  });
});
