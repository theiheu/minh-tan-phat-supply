import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ZoomableImage, ImageLightbox } from "./image-lightbox";

describe("ImageLightbox", () => {
  it("does not bubble click events to parent when closing via backdrop", () => {
    const onParentClick = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <div onClick={onParentClick}>
        <ImageLightbox
          open={true}
          onOpenChange={onOpenChange}
          images={["https://example.com/1.jpg"]}
          title="Ảnh xem trước"
        />
      </div>
    );

    const dialog = screen.getByRole("dialog", { name: "Ảnh xem trước" });
    fireEvent.click(dialog);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("does not bubble click events to parent when closing via close button", () => {
    const onParentClick = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <div onClick={onParentClick}>
        <ImageLightbox
          open={true}
          onOpenChange={onOpenChange}
          images={["https://example.com/1.jpg"]}
          title="Ảnh xem trước"
        />
      </div>
    );

    const closeBtn = screen.getByRole("button", { name: "Đóng ảnh phóng to" });
    fireEvent.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("does not bubble navigation click events to parent", () => {
    const onParentClick = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <div onClick={onParentClick}>
        <ImageLightbox
          open={true}
          onOpenChange={onOpenChange}
          images={["https://example.com/1.jpg", "https://example.com/2.jpg"]}
          title="Ảnh xem trước"
        />
      </div>
    );

    const nextBtn = screen.getByRole("button", { name: "Ảnh sau" });
    fireEvent.click(nextBtn);

    const prevBtn = screen.getByRole("button", { name: "Ảnh trước" });
    fireEvent.click(prevBtn);

    expect(onParentClick).not.toHaveBeenCalled();
  });
});

describe("ZoomableImage", () => {
  it("opens lightbox on click without triggering parent onClick", () => {
    const onParentClick = vi.fn();

    render(
      <div onClick={onParentClick}>
        <ZoomableImage
          src="https://example.com/1.jpg"
          alt="Ảnh vật tư"
          images={["https://example.com/1.jpg"]}
        />
      </div>
    );

    const img = screen.getByAltText("Ảnh vật tư");
    fireEvent.click(img);

    expect(onParentClick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Ảnh vật tư" })).toBeInTheDocument();
  });
});
