"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export interface BrandLoadingProps {
  /** Kiểu hiển thị: fullscreen (toàn màn hình), page (giữa trang), inline (nhỏ gọn), overlay (phủ lên card/bảng) */
  variant?: "fullscreen" | "page" | "inline" | "overlay";
  /** Kích thước của loading logo: sm, md, lg, xl */
  size?: "sm" | "md" | "lg" | "xl";
  /** Tiêu đề thương hiệu phía trên */
  title?: string;
  /** Thông điệp trạng thái đang tải */
  message?: string;
  /** Hiển thị tên thương hiệu hay không */
  showBrandTitle?: boolean;
  /** Hiển thị 3 chấm chuyển động hay không */
  showDots?: boolean;
  /** Hiển thị vòng xoay spinner quanh logo */
  showSpinnerRing?: boolean;
  /** Hiển thị hiệu ứng hào quang phát sáng */
  showGlow?: boolean;
  /** Đường dẫn file logo */
  logoSrc?: string;
  /** Class bổ sung cho container ngoài */
  className?: string;
  /** Class bổ sung cho logo wrapper */
  logoClassName?: string;
  /** Class bổ sung cho vùng text */
  textClassName?: string;
}

const SIZE_CONFIG = {
  sm: {
    container: "size-14",
    imageSize: 28,
    badgeRounded: "rounded-xl",
    padding: "p-1.5",
    titleText: "text-[9px] tracking-[0.2em]",
    messageText: "text-xs",
    dotSize: "size-1",
    strokeWidth: 3,
    glowInset: "-inset-1.5",
  },
  md: {
    container: "size-20",
    imageSize: 42,
    badgeRounded: "rounded-2xl",
    padding: "p-2.5",
    titleText: "text-[11px] tracking-[0.25em]",
    messageText: "text-sm",
    dotSize: "size-1.5",
    strokeWidth: 3.5,
    glowInset: "-inset-2.5",
  },
  lg: {
    container: "size-28",
    imageSize: 60,
    badgeRounded: "rounded-3xl",
    padding: "p-3.5",
    titleText: "text-xs tracking-[0.28em]",
    messageText: "text-base",
    dotSize: "size-2",
    strokeWidth: 4,
    glowInset: "-inset-3.5",
  },
  xl: {
    container: "size-36",
    imageSize: 80,
    badgeRounded: "rounded-[2rem]",
    padding: "p-5",
    titleText: "text-sm tracking-[0.3em]",
    messageText: "text-lg",
    dotSize: "size-2.5",
    strokeWidth: 4.5,
    glowInset: "-inset-5",
  },
};

export function BrandLoading({
  variant = "page",
  size = "md",
  title = "TRẠI GÀ MINH TÂN PHÁT",
  message = "Đang tải dữ liệu...",
  showBrandTitle = true,
  showDots = true,
  showSpinnerRing = true,
  showGlow = true,
  logoSrc = "/brand/logo.png",
  className,
  logoClassName,
  textClassName,
}: BrandLoadingProps) {
  const config = SIZE_CONFIG[size];
  const hasVisibleText = (showBrandTitle && Boolean(title)) || Boolean(message);

  const variantClasses = {
    fullscreen:
      "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md p-4 transition-all duration-300",
    page: "flex min-h-[50vh] w-full flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300",
    inline: "flex flex-col items-center justify-center p-4 text-center",
    overlay:
      "absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/75 backdrop-blur-[2px] p-4 text-center rounded-[inherit] animate-in fade-in duration-200",
  }[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message || title || "Đang tải"}
      className={cn(variantClasses, className)}
    >
      <div className="relative flex flex-col items-center">
        {/* Khối Logo trung tâm kèm hiệu ứng xoay & phát sáng */}
        <div className={cn("relative flex items-center justify-center", config.container, logoClassName)}>
          {/* Hào quang nền (Ambient Glow) */}
          {showGlow && (
            <div
              className={cn(
                "absolute rounded-full bg-primary/20 blur-xl animate-pulse pointer-events-none",
                config.glowInset
              )}
              aria-hidden="true"
            />
          )}

          {/* Vòng xoay Spinner SVG bên ngoài logo */}
          {showSpinnerRing && (
            <svg
              className="absolute inset-0 size-full -rotate-90 animate-spin pointer-events-none"
              style={{ animationDuration: "1.8s" }}
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              {/* Vòng ray mờ */}
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeWidth={config.strokeWidth}
                className="text-primary/15 dark:text-primary/20"
              />
              {/* Vòng quét nổi bật */}
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeWidth={config.strokeWidth}
                strokeDasharray="276"
                strokeDashoffset="190"
                strokeLinecap="round"
                className="text-primary"
              />
            </svg>
          )}

          {/* Hộp Logo chính */}
          <div
            className={cn(
              "relative z-10 flex size-full items-center justify-center bg-white dark:bg-card shadow-lg shadow-primary/10 ring-1 ring-border/80 transition-transform",
              config.badgeRounded,
              config.padding
            )}
          >
            <div className="relative size-full overflow-hidden flex items-center justify-center">
              <Image
                src={logoSrc}
                alt="Logo Trại gà Minh Tân Phát"
                width={config.imageSize}
                height={config.imageSize}
                className="size-full object-contain select-none pointer-events-none drop-shadow-sm"
                priority
              />
            </div>
          </div>
        </div>

        {/* Khối Text thông tin thương hiệu & trạng thái */}
        {hasVisibleText && (
          <div className={cn("mt-4 flex flex-col items-center text-center space-y-1", textClassName)}>
            {showBrandTitle && title && (
              <div
                className={cn(
                  "font-bold uppercase text-primary select-none drop-shadow-sm",
                  config.titleText
                )}
              >
                {title}
              </div>
            )}

            {message && (
              <div
                className={cn(
                  "font-medium text-foreground/80 flex items-center justify-center gap-1.5",
                  config.messageText
                )}
              >
                <span>{message}</span>

                {/* 3 chấm chuyển động nhịp nhàng */}
                {showDots && (
                  <span className="inline-flex items-center gap-1 ml-0.5" aria-hidden="true">
                    <span
                      className={cn(
                        "rounded-full bg-primary animate-bounce",
                        config.dotSize
                      )}
                      style={{ animationDelay: "0ms", animationDuration: "1s" }}
                    />
                    <span
                      className={cn(
                        "rounded-full bg-primary animate-bounce",
                        config.dotSize
                      )}
                      style={{ animationDelay: "150ms", animationDuration: "1s" }}
                    />
                    <span
                      className={cn(
                        "rounded-full bg-primary animate-bounce",
                        config.dotSize
                      )}
                      style={{ animationDelay: "300ms", animationDuration: "1s" }}
                    />
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SR only text nếu không có text hiển thị ra ngoài */}
      {!hasVisibleText && (
        <span className="sr-only">Đang tải dữ liệu...</span>
      )}
    </div>
  );
}

/** Component hiển thị màn hình loading toàn trang kèm logo chính */
export function BrandLoadingScreen(props: Omit<BrandLoadingProps, "variant">) {
  return <BrandLoading variant="fullscreen" size="lg" {...props} />;
}

/** Component hiển thị loading phủ lên nội dung (overlay) kèm logo chính */
export function BrandLoadingOverlay(props: Omit<BrandLoadingProps, "variant">) {
  return <BrandLoading variant="overlay" size="md" {...props} />;
}

/** Component hiển thị icon logo spinner nhỏ gọn */
export function BrandSpinner({
  size = "sm",
  showBrandTitle = false,
  message,
  showDots = false,
  ...props
}: Omit<BrandLoadingProps, "variant">) {
  return (
    <BrandLoading
      variant="inline"
      size={size}
      showBrandTitle={showBrandTitle}
      message={message}
      showDots={showDots}
      {...props}
    />
  );
}
