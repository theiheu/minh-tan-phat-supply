import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVehicleAction,
  updateVehicleAction,
  updateVehicleDocumentsAction,
  toggleVehicleActiveAction,
} from "./actions";

const mockRevalidatePath = vi.fn();
const mockRequireManager = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

vi.mock("@/lib/auth", () => ({
  requireManager: () => mockRequireManager(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "vehicles") {
          return {
            insert: mockInsert,
            update: mockUpdate,
            select: mockSelect,
          };
        }
        return {};
      }),
    }),
  ),
}));

describe("Vehicle Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireManager.mockResolvedValue({ id: "mgr-1", role: "warehouse" });
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "veh-123" }, error: null }),
      }),
    });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockSelect.mockReturnValue({
      order: mockOrder.mockReturnValue({
        eq: mockEq.mockResolvedValue({ data: [], error: null }),
      }),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "veh-123", code: "61C-123.45", document_images: ["https://example.com/doc.jpg"] },
          error: null,
        }),
      }),
    });
  });

  it("creates a vehicle with documentImages", async () => {
    const input = {
      code: "61C-123.45",
      name: "Xe tải Howo",
      type: "truck" as const,
      currentOdo: 1000,
      odoUnit: "km" as const,
      fuelNorm: 30,
      documentImages: ["https://example.com/cavet.jpg", "https://example.com/dangkiem.jpg"],
    };

    const id = await createVehicleAction(input);
    expect(id).toBe("veh-123");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "61C-123.45",
        name: "Xe tải Howo",
        document_images: ["https://example.com/cavet.jpg", "https://example.com/dangkiem.jpg"],
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/vehicles");
  });

  it("updates vehicle and its documentImages", async () => {
    const input = {
      code: "61C-123.45",
      name: "Xe tải Howo cập nhật",
      type: "truck" as const,
      currentOdo: 1500,
      odoUnit: "km" as const,
      fuelNorm: 32,
      documentImages: ["https://example.com/cavet-new.jpg"],
    };

    await updateVehicleAction("veh-123", input);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "61C-123.45",
        name: "Xe tải Howo cập nhật",
        document_images: ["https://example.com/cavet-new.jpg"],
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/vehicles");
  });

  it("updates vehicle document images directly via updateVehicleDocumentsAction", async () => {
    const nextImages = [
      "https://example.com/doc1.jpg",
      "https://example.com/doc2.jpg",
    ];

    await updateVehicleDocumentsAction("veh-123", nextImages);
    expect(mockUpdate).toHaveBeenCalledWith({
      document_images: nextImages,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/vehicles");
  });

  it("toggles vehicle active status", async () => {
    await toggleVehicleActiveAction("veh-123", false);
    expect(mockUpdate).toHaveBeenCalledWith({
      is_active: false,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/vehicles");
  });
});
