import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VehicleList, type VehicleListRow } from "./vehicle-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("../actions", () => ({
  toggleVehicleActiveAction: vi.fn(),
  updateVehicleDocumentsAction: vi.fn(),
}));

vi.mock("@/components/image-lightbox", () => ({
  ZoomableImage: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt} />,
}));

describe("VehicleList Component", () => {
  const mockVehicles: VehicleListRow[] = [
    {
      id: "v-1",
      code: "61C-123.45",
      name: "Xe ben Howo",
      type: "truck",
      zoneId: "z-1",
      zoneName: "Khu A",
      defaultDriver: "Nguyễn Văn A",
      fuelTypeId: "ft-1",
      fuelTypeName: "Dầu DO 0.05S",
      currentOdo: 50000,
      odoUnit: "km",
      fuelNorm: 35,
      qrToken: "VEH_61C-123.45",
      notes: null,
      isActive: true,
      documentImages: ["https://example.com/cavet.jpg", "https://example.com/dangkiem.jpg"],
    },
    {
      id: "v-2",
      code: "MAY-XUC-01",
      name: "Máy xúc Kobelco",
      type: "excavator",
      zoneId: null,
      zoneName: null,
      defaultDriver: null,
      fuelTypeId: "ft-1",
      fuelTypeName: "Dầu DO 0.05S",
      currentOdo: 1200,
      odoUnit: "hours",
      fuelNorm: 12,
      qrToken: "VEH_MAY-XUC-01",
      notes: null,
      isActive: true,
      documentImages: [],
    },
  ];

  it("renders table with vehicle records and document badges", () => {
    render(
      <VehicleList
        vehicles={mockVehicles}
        fuelTypes={[{ id: "ft-1", name: "Dầu DO 0.05S" }]}
        zones={[{ id: "z-1", name: "Khu A" }]}
        page={1}
        totalPages={1}
        filters={{ q: "", type: "", status: "" }}
      />
    );

    expect(screen.getAllByText("61C-123.45").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Xe ben Howo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MAY-XUC-01").length).toBeGreaterThan(0);

    // Check document images count button for 61C-123.45
    expect(screen.getByText("2 ảnh")).toBeInTheDocument();

    // Check "+ Tải ảnh" button for MAY-XUC-01
    expect(screen.getByText("+ Tải ảnh")).toBeInTheDocument();
  });

  it("opens VehicleDocumentsModal when clicking document button", () => {
    render(
      <VehicleList
        vehicles={mockVehicles}
        fuelTypes={[{ id: "ft-1", name: "Dầu DO 0.05S" }]}
        zones={[{ id: "z-1", name: "Khu A" }]}
        page={1}
        totalPages={1}
        filters={{ q: "", type: "", status: "" }}
      />
    );

    const docBtn = screen.getByRole("button", { name: /2 ảnh/i });
    fireEvent.click(docBtn);

    expect(screen.getByText(/Ảnh giấy tờ & Hồ sơ xe: 61C-123.45/i)).toBeInTheDocument();
  });
});
