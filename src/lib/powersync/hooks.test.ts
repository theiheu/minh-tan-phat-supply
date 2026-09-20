import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  usePowerSyncCatalog,
  usePowerSyncVehicles,
  usePowerSyncSyncStatus,
} from "./hooks";

const mockUseQuery = vi.fn();
const mockUseStatus = vi.fn();

vi.mock("@powersync/react", () => ({
  useQuery: (sql: string, params: any[]) => mockUseQuery(sql, params),
  useStatus: () => mockUseStatus(),
}));

vi.mock("./provider", () => ({
  usePowerSyncState: () => ({
    db: {},
    isReady: true,
    error: null,
  }),
}));

describe("PowerSync Specialized Hooks", () => {
  it("usePowerSyncCatalog constructs correct SQL query and returns items", () => {
    const mockData = [
      { id: "sku-1", name: "Bóng đèn 40W", sku_code: "DEN40W", product_name: "Bóng đèn" },
    ];
    mockUseQuery.mockReturnValueOnce({ data: mockData, isLoading: false, error: null });

    const { result } = renderHook(() =>
      usePowerSyncCatalog({ q: "bóng đèn", activeOnly: true })
    );

    expect(result.current.items).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM skus s"),
      expect.arrayContaining(["%bóng đèn%"])
    );
  });

  it("usePowerSyncVehicles constructs correct SQL query for vehicles", () => {
    const mockVehicles = [
      { id: "veh-1", code: "XE-01", name: "Xe Tải Hino 5 Tấn", is_active: 1 },
    ];
    mockUseQuery.mockReturnValueOnce({ data: mockVehicles, isLoading: false, error: null });

    const { result } = renderHook(() => usePowerSyncVehicles({ activeOnly: true }));

    expect(result.current.vehicles).toEqual(mockVehicles);
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM vehicles v"),
      expect.anything()
    );
  });

  it("usePowerSyncSyncStatus returns sync status properly", () => {
    mockUseStatus.mockReturnValueOnce({
      connected: true,
      hasSynced: true,
      downloading: false,
      uploading: false,
    });

    const { result } = renderHook(() => usePowerSyncSyncStatus());

    expect(result.current.isReady).toBe(true);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.hasSynced).toBe(true);
    expect(result.current.downloading).toBe(false);
  });
});
