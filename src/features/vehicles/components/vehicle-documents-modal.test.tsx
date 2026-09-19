import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VehicleDocumentsModal } from "./vehicle-documents-modal";

const mockUpdateVehicleDocumentsAction = vi.fn();
const mockUploadVehicleDocumentImage = vi.fn();

vi.mock("../actions", () => ({
  updateVehicleDocumentsAction: (...args: unknown[]) => mockUpdateVehicleDocumentsAction(...args),
}));

vi.mock("../upload", () => ({
  uploadVehicleDocumentImage: (...args: unknown[]) => mockUploadVehicleDocumentImage(...args),
}));

vi.mock("@/components/image-lightbox", () => ({
  ZoomableImage: ({ src, alt }: { src: string; alt?: string }) => <img src={src} alt={alt} />,
}));

describe("VehicleDocumentsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateVehicleDocumentsAction.mockResolvedValue(undefined);
    mockUploadVehicleDocumentImage.mockResolvedValue("https://example.com/uploaded.jpg");
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  const mockVehicle = {
    id: "veh-1",
    code: "61C-999.88",
    name: "Xe tải Howo",
    documentImages: ["https://example.com/doc1.jpg", "https://example.com/doc2.jpg"],
  };

  it("renders modal with vehicle code, title and images when open", () => {
    render(
      <VehicleDocumentsModal
        vehicle={mockVehicle}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Ảnh giấy tờ & Hồ sơ xe: 61C-999.88/i)).toBeInTheDocument();
    expect(screen.getByText(/2 ảnh/i)).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("renders empty state when vehicle has no document images", () => {
    render(
      <VehicleDocumentsModal
        vehicle={{ id: "veh-2", code: "MAY-01", name: "Máy xúc", documentImages: [] }}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Chưa có ảnh giấy tờ hoặc hồ sơ nào cho xe này/i)).toBeInTheDocument();
  });

  it("handles deleting an image with confirmation", async () => {
    const onImagesUpdated = vi.fn();
    render(
      <VehicleDocumentsModal
        vehicle={mockVehicle}
        open={true}
        onOpenChange={vi.fn()}
        onImagesUpdated={onImagesUpdated}
      />
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Xóa ảnh này/i });
    expect(deleteButtons).toHaveLength(2);

    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockUpdateVehicleDocumentsAction).toHaveBeenCalledWith("veh-1", ["https://example.com/doc2.jpg"]);
      expect(onImagesUpdated).toHaveBeenCalledWith(["https://example.com/doc2.jpg"]);
    });
  });
});
