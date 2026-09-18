import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoading } from "@/components/brand-loading";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập Hệ thống Quản lý Kho & Vật tư Trại Gà Minh Tân Phát",
};

export default function LoginPage() {
  return (
    <div className="relative flex h-dvh max-h-dvh w-full items-center justify-center overflow-hidden bg-background p-4 select-none-subtle">
      {/* Dynamic Ambient Background Glows */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-primary/20 blur-3xl opacity-60 dark:opacity-30"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 size-96 rounded-full bg-amber-500/20 blur-3xl opacity-50 dark:opacity-20"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[32rem] rounded-full bg-primary/10 blur-[100px] opacity-40 dark:opacity-20"
        aria-hidden="true"
      />

      {/* Subtle Geometric / Dot Matrix Background Grid */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(120,119,198,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,119,198,0.06)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)]"
        aria-hidden="true"
      />

      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-3 right-3 z-20">
        <ThemeToggle />
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex w-full max-w-sm sm:max-w-md flex-col items-center gap-3">
        <Suspense
          fallback={
            <div className="flex h-96 w-full max-w-sm sm:max-w-md items-center justify-center rounded-2xl border border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-md">
              <BrandLoading variant="inline" size="md" message="Đang tải đăng nhập..." />
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="text-center text-[11px] text-muted-foreground/70">
          © {new Date().getFullYear()} Trại gà Minh Tân Phát • Quản lý Vật tư & Kho
        </p>
      </div>
    </div>
  );
}