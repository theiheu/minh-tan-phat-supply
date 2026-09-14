import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BrandLoading,
  BrandLoadingScreen,
  BrandLoadingOverlay,
  BrandSpinner,
} from "./brand-loading";

describe("BrandLoading", () => {
  it("renders with default props", () => {
    render(<BrandLoading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("TRẠI GÀ MINH TÂN PHÁT")).toBeInTheDocument();
    expect(screen.getByText("Đang tải dữ liệu...")).toBeInTheDocument();
    const logoImg = screen.getByAltText("Logo Trại gà Minh Tân Phát");
    expect(logoImg).toBeInTheDocument();
    expect(decodeURIComponent(logoImg.getAttribute("src") || "")).toContain("/brand/logo.png");
  });

  it("renders custom title and message", () => {
    render(
      <BrandLoading
        title="KHO MINH TÂN PHÁT"
        message="Đang đồng bộ dữ liệu ngoại tuyến..."
      />
    );
    expect(screen.getByText("KHO MINH TÂN PHÁT")).toBeInTheDocument();
    expect(screen.getByText("Đang đồng bộ dữ liệu ngoại tuyến...")).toBeInTheDocument();
  });

  it("can hide brand title or message", () => {
    const { rerender } = render(<BrandLoading showBrandTitle={false} message="Đang xử lý..." />);
    expect(screen.queryByText("TRẠI GÀ MINH TÂN PHÁT")).not.toBeInTheDocument();
    expect(screen.getByText("Đang xử lý...")).toBeInTheDocument();

    rerender(<BrandLoading showBrandTitle={false} message="" />);
    expect(screen.queryByText("TRẠI GÀ MINH TÂN PHÁT")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders all size variants correctly", () => {
    const sizes = ["sm", "md", "lg", "xl"] as const;
    sizes.forEach((size) => {
      const { unmount } = render(<BrandLoading size={size} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
      unmount();
    });
  });

  it("renders all visual variants correctly", () => {
    const variants = ["fullscreen", "page", "inline", "overlay"] as const;
    variants.forEach((variant) => {
      const { unmount } = render(<BrandLoading variant={variant} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
      unmount();
    });
  });

  it("renders BrandLoadingScreen shorthand", () => {
    render(<BrandLoadingScreen message="Đang khởi tạo hệ thống..." />);
    expect(screen.getByRole("status")).toHaveClass("fixed");
    expect(screen.getByText("Đang khởi tạo hệ thống...")).toBeInTheDocument();
  });

  it("renders BrandLoadingOverlay shorthand", () => {
    render(<BrandLoadingOverlay message="Đang lưu thông tin..." />);
    expect(screen.getByRole("status")).toHaveClass("absolute");
    expect(screen.getByText("Đang lưu thông tin...")).toBeInTheDocument();
  });

  it("renders BrandSpinner shorthand without title by default", () => {
    render(<BrandSpinner />);
    expect(screen.queryByText("TRẠI GÀ MINH TÂN PHÁT")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("supports custom logoSrc and custom classNames", () => {
    render(
      <BrandLoading
        logoSrc="/brand/custom-logo.png"
        className="custom-container"
        logoClassName="custom-logo-wrapper"
        textClassName="custom-text-wrapper"
      />
    );
    const logoImg = screen.getByAltText("Logo Trại gà Minh Tân Phát");
    expect(logoImg.getAttribute("src")).toContain("custom-logo.png");
    expect(screen.getByRole("status")).toHaveClass("custom-container");
  });
});
