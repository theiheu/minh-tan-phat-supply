import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MultiImagePicker } from "./multi-image-picker";

// Mock ZoomableImage
vi.mock("@/components/image-lightbox", () => ({
  ZoomableImage: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="zoomable-img" />
  ),
}));

describe("MultiImagePicker", () => {
  it("renders image thumbnails and count badge", () => {
    const images: string[] = ["https://example.com/1.jpg", "https://example.com/2.jpg"];
    const onChange = vi.fn();

    render(<MultiImagePicker label="Ảnh vật tư" images={images} onChange={onChange} />);

    expect(screen.getByText("Ảnh vật tư")).toBeInTheDocument();
    expect(screen.getByText("(2 ảnh)")).toBeInTheDocument();
    const imgs = screen.getAllByTestId("zoomable-img");
    expect(imgs).toHaveLength(2);
  });

  it("calls onChange with filtered images when delete button is clicked", () => {
    const images: string[] = ["https://example.com/1.jpg", "https://example.com/2.jpg"];
    const onChange = vi.fn();

    render(<MultiImagePicker images={images} onChange={onChange} />);

    const removeButtons = screen.getAllByRole("button", { name: "Xóa ảnh này" });
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith(["https://example.com/2.jpg"]);
  });

  it("calls onUpload and onChange with newly uploaded image url when files are selected", async () => {
    const images: string[] = ["https://example.com/1.jpg"];
    const onChange = vi.fn();
    const onUpload = vi.fn(async (file: File) => `https://example.com/uploaded-${file.name}`);

    const { container } = render(
      <MultiImagePicker images={images} onChange={onChange} onUpload={onUpload} />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    const file = new File(["dummy content"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(file);
      expect(onChange).toHaveBeenCalledWith([
        "https://example.com/1.jpg",
        "https://example.com/uploaded-photo.jpg",
      ]);
    });
  });
});
