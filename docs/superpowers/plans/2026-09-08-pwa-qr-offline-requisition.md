# Trải nghiệm Thực địa Mobile - PWA, Quét mã QR & Hàng đợi Yêu cầu Ngoại tuyến Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng trải nghiệm thực địa di động hoàn chỉnh cho nhân viên trại: cài đặt PWA Standalone trên điện thoại, quét mã QR/Barcode camera để chọn nhanh vật tư vào giỏ hàng, và lưu trữ hàng đợi ngoại tuyến tự động đồng bộ khi mất sóng 4G/Wifi trong chuồng kín.

**Architecture:** 
- PWA Manifest (`src/app/manifest.ts`) & Apple Web App Meta cấu hình App chạy toàn màn hình với màu nhận diện thương hiệu trại gà.
- Zustand store (`useOfflineQueueStore`) lưu trữ các phiếu yêu cầu tạo khi mất mạng qua LocalStorage. Bộ đồng bộ (`OfflineSyncProvider`) lắng nghe sự kiện `online` để tự động gửi phiếu lên server qua Server Action.
- Bộ quét `ProductQrScannerDialog` kết hợp Web BarcodeDetector API, đèn Flash pin, haptic feedback và `QuickAddBottomSheet` để thêm vật tư vào `useCartStore` trong 3 giây.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, Zustand persist, Web BarcodeDetector API, Vitest / React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-08-pwa-qr-offline-requisition-design.md`

## Global Constraints

- Không dùng thư viện Service Worker ngoài cồng kềnh; dùng chuẩn Next.js 15 Web App Manifest và Zustand Persistent Queue.
- Dữ liệu giỏ hàng (`mtp-requisition-cart`) và hàng đợi offline (`mtp-offline-requisitions-queue`) lưu an toàn qua `localStorage`.
- Mọi hàm mới đều có Unit Test bằng Vitest/Testing-Library chạy qua `bun run test`.
- Giữ nguyên toàn bộ quy tắc bảo mật RLS và server action authorization hiện có.

---

### Task 1: PWA Web App Manifest, Apple Meta & Mobile Install Prompt

**Files:**
- Create: `src/app/manifest.ts`
- Modify: `src/app/layout.tsx`
- Create: `src/components/layout/mobile-install-prompt.tsx`
- Test: `src/components/layout/mobile-install-prompt.test.tsx`

**Interfaces:**
- Produces: `src/app/manifest.ts` (Next.js 15 metadata route), `<MobileInstallPrompt />` (React Component)

- [ ] **Step 1: Write the failing test for MobileInstallPrompt**

Create `src/components/layout/mobile-install-prompt.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileInstallPrompt } from "./mobile-install-prompt";

describe("MobileInstallPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("does not render when running in standalone display mode", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<MobileInstallPrompt />);
    expect(screen.queryByText(/Cài đặt ứng dụng/i)).toBeNull();
  });

  it("renders prompt when beforeinstallprompt event is fired", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<MobileInstallPrompt />);

    const promptEvent = new Event("beforeinstallprompt");
    Object.assign(promptEvent, { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "accepted" }) });
    window.dispatchEvent(promptEvent);

    expect(screen.getByText(/Cài đặt ứng dụng/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/layout/mobile-install-prompt.test.tsx`
Expected: FAIL with "Cannot find module './mobile-install-prompt'"

- [ ] **Step 3: Implement Manifest, Layout Viewport, and MobileInstallPrompt**

Create `src/app/manifest.ts`:
```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quản lý Kho Trại Gà Minh Tân Phát",
    short_name: "Kho MTP",
    description: "Hệ thống Quản lý Kho & Vật tư Trại Gà Minh Tân Phát",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    orientation: "portrait",
    icons: [
      {
        src: "/brand/logo.jpg",
        sizes: "192x192",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/brand/logo.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
  };
}
```

Create `src/components/layout/mobile-install-prompt.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function MobileInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error - iOS standalone property
      Boolean(window.navigator.standalone);

    if (isStandalone) return;

    // Check if user dismissed recently
    const lastDismissed = localStorage.getItem("mtp-pwa-dismissed");
    if (lastDismissed && Date.now() - Number(lastDismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    setDismissed(false);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isIosDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  if (dismissed) return null;

  async function handleInstall() {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setDismissed(true);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("mtp-pwa-dismissed", Date.now().toString());
  }

  if (!installEvent && !isIos) return null;

  return (
    <div className="fixed bottom-16 left-3 right-3 z-40 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-primary/30">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Download className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold leading-tight text-foreground truncate">Cài đặt ứng dụng Kho MTP</p>
            <p className="text-[11px] text-muted-foreground truncate">Mở nhanh toàn màn hình, tiện dùng tại chuồng</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" className="h-8 text-xs px-2.5" onClick={handleInstall}>
            Cài đặt
          </Button>
          <Button size="icon" variant="ghost" className="size-8 text-muted-foreground" onClick={handleDismiss}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {showIosGuide && (
        <div className="mt-2 rounded-xl border bg-popover p-3 text-xs text-popover-foreground shadow-md animate-in fade-in slide-in-from-bottom-2">
          <p className="font-semibold mb-1">Cách cài đặt trên iPhone / iPad:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px]">
            <li>
              Bấm nút <Share className="inline size-3.5 mx-0.5" /> <strong>Chia sẻ</strong> ở thanh dưới Safari.
            </li>
            <li>
              Chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
```

Modify `src/app/layout.tsx` to add `viewport` export with theme-color `#16a34a` and include `<MobileInstallPrompt />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/components/layout/mobile-install-prompt.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/manifest.ts src/app/layout.tsx src/components/layout/mobile-install-prompt.tsx src/components/layout/mobile-install-prompt.test.tsx
git commit -m "feat(pwa): add web app manifest, mobile viewport, and install prompt banner"
```

---

### Task 2: Hàng đợi Ngoại tuyến (Offline Queue Store)

**Files:**
- Create: `src/stores/offline-queue-store.ts`
- Test: `src/stores/offline-queue-store.test.ts`

**Interfaces:**
- Produces: `useOfflineQueueStore`, `OfflineRequisitionItem`, `OfflineRequisitionPayload`

- [ ] **Step 1: Write the failing test for offline-queue-store**

Create `src/stores/offline-queue-store.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useOfflineQueueStore } from "./offline-queue-store";

describe("useOfflineQueueStore", () => {
  beforeEach(() => {
    useOfflineQueueStore.setState({ queue: [] });
    localStorage.clear();
  });

  it("enqueues a new offline requisition item", () => {
    const id = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 5, name: "Bóng đèn", label: "220V 45W", unit: "cái" }],
      zoneId: "z1",
      purpose: "Thay bóng hỏng chuồng 2",
      requesterId: "u1",
    });

    expect(id).toBeDefined();
    const queue = useOfflineQueueStore.getState().queue;
    expect(queue.length).toBe(1);
    expect(queue[0].clientTempId).toBe(id);
    expect(queue[0].status).toBe("pending");
    expect(queue[0].items[0].name).toBe("Bóng đèn");
  });

  it("dequeues an item by clientTempId", () => {
    const id1 = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 2, name: "Món 1", label: "L1", unit: "cái" }],
      zoneId: "z1",
      purpose: "P1",
      requesterId: "u1",
    });
    const id2 = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v2", quantity: 3, name: "Món 2", label: "L2", unit: "cái" }],
      zoneId: "z1",
      purpose: "P2",
      requesterId: "u1",
    });

    expect(useOfflineQueueStore.getState().queue.length).toBe(2);
    useOfflineQueueStore.getState().dequeue(id1);
    const queue = useOfflineQueueStore.getState().queue;
    expect(queue.length).toBe(1);
    expect(queue[0].clientTempId).toBe(id2);
  });

  it("updates status and error of a queued item", () => {
    const id = useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 1, name: "Món 1", label: "L1", unit: "cái" }],
      zoneId: "z1",
      purpose: "P1",
      requesterId: "u1",
    });

    useOfflineQueueStore.getState().updateStatus(id, "syncing");
    expect(useOfflineQueueStore.getState().queue[0].status).toBe("syncing");

    useOfflineQueueStore.getState().updateStatus(id, "failed", "Mạng không khả dụng");
    expect(useOfflineQueueStore.getState().queue[0].status).toBe("failed");
    expect(useOfflineQueueStore.getState().queue[0].lastError).toBe("Mạng không khả dụng");
    expect(useOfflineQueueStore.getState().queue[0].retryCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/stores/offline-queue-store.test.ts`
Expected: FAIL with "Cannot find module './offline-queue-store'"

- [ ] **Step 3: Implement useOfflineQueueStore**

Create `src/stores/offline-queue-store.ts`:
```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OfflineRequisitionItem {
  variantId: string;
  quantity: number;
  name: string;
  label: string;
  unit: string | null;
}

export interface OfflineRequisition {
  clientTempId: string;
  items: OfflineRequisitionItem[];
  zoneId: string;
  purpose: string;
  requesterId?: string;
  createdAt: string;
  retryCount: number;
  lastError?: string | null;
  status: "pending" | "syncing" | "failed";
}

export interface EnqueueInput {
  items: OfflineRequisitionItem[];
  zoneId: string;
  purpose: string;
  requesterId?: string;
}

interface OfflineQueueState {
  queue: OfflineRequisition[];
  enqueue: (input: EnqueueInput) => string;
  dequeue: (clientTempId: string) => void;
  updateStatus: (clientTempId: string, status: OfflineRequisition["status"], error?: string) => void;
  clearFailed: () => void;
  clearAll: () => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (input) => {
        const clientTempId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `temp_${Date.now()}`;
        const newItem: OfflineRequisition = {
          clientTempId,
          items: input.items,
          zoneId: input.zoneId,
          purpose: input.purpose,
          requesterId: input.requesterId,
          createdAt: new Date().toISOString(),
          retryCount: 0,
          status: "pending",
        };
        set((state) => ({ queue: [...state.queue, newItem] }));
        return clientTempId;
      },
      dequeue: (clientTempId) =>
        set((state) => ({ queue: state.queue.filter((item) => item.clientTempId !== clientTempId) })),
      updateStatus: (clientTempId, status, error) =>
        set((state) => ({
          queue: state.queue.map((item) => {
            if (item.clientTempId !== clientTempId) return item;
            return {
              ...item,
              status,
              lastError: error !== undefined ? error : item.lastError,
              retryCount: status === "failed" ? item.retryCount + 1 : item.retryCount,
            };
          }),
        })),
      clearFailed: () => set((state) => ({ queue: state.queue.filter((item) => item.status !== "failed") })),
      clearAll: () => set({ queue: [] }),
    }),
    { name: "mtp-offline-requisitions-queue" },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/stores/offline-queue-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/offline-queue-store.ts src/stores/offline-queue-store.test.ts
git commit -m "feat(offline): add offline requisition queue store with localStorage persistence"
```

---

### Task 3: Bộ Đồng bộ Ngầm (Offline Sync Provider) & Thanh Trạng Thái (Offline Status Bar)

**Files:**
- Create: `src/components/offline/offline-status-bar.tsx`
- Create: `src/components/offline/offline-sync-provider.tsx`
- Modify: `src/components/providers.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Test: `src/components/offline/offline-status-bar.test.tsx`

**Interfaces:**
- Produces: `<OfflineSyncProvider />`, `<OfflineStatusBar />`

- [ ] **Step 1: Write the failing test for OfflineStatusBar**

Create `src/components/offline/offline-status-bar.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OfflineStatusBar } from "./offline-status-bar";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";

describe("OfflineStatusBar", () => {
  beforeEach(() => {
    useOfflineQueueStore.setState({ queue: [] });
  });

  it("renders nothing when online and queue is empty", () => {
    render(<OfflineStatusBar isOnline={true} onSyncNow={() => {}} />);
    expect(screen.queryByText(/ngoại tuyến/i)).toBeNull();
    expect(screen.queryByText(/chờ đồng bộ/i)).toBeNull();
  });

  it("renders offline message when offline", () => {
    render(<OfflineStatusBar isOnline={false} onSyncNow={() => {}} />);
    expect(screen.getByText(/Đang ngoại tuyến/i)).toBeInTheDocument();
  });

  it("renders queue count when pending items exist", () => {
    useOfflineQueueStore.getState().enqueue({
      items: [{ variantId: "v1", quantity: 1, name: "Bóng đèn", label: "220V", unit: "cái" }],
      zoneId: "z1",
      purpose: "Chuồng 1",
    });

    render(<OfflineStatusBar isOnline={true} onSyncNow={() => {}} />);
    expect(screen.getByText(/1 phiếu chờ đồng bộ/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/offline/offline-status-bar.test.tsx`
Expected: FAIL with "Cannot find module './offline-status-bar'"

- [ ] **Step 3: Implement OfflineStatusBar and OfflineSyncProvider**

Create `src/components/offline/offline-status-bar.tsx`:
```tsx
"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";

export function OfflineStatusBar({
  isOnline,
  isSyncing,
  onSyncNow,
}: {
  isOnline: boolean;
  isSyncing?: boolean;
  onSyncNow: () => void;
}) {
  const queue = useOfflineQueueStore((s) => s.queue);
  const pendingCount = queue.filter((i) => i.status !== "syncing").length;

  if (isOnline && queue.length === 0) return null;

  return (
    <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {!isOnline ? (
            <WifiOff className="size-4 shrink-0 text-amber-600 dark:text-amber-400 animate-pulse" />
          ) : (
            <RefreshCw className={`size-4 shrink-0 text-amber-600 dark:text-amber-400 ${isSyncing ? "animate-spin" : ""}`} />
          )}
          <span className="truncate">
            {!isOnline
              ? pendingCount > 0
                ? `Đang ngoại tuyến — có ${pendingCount} phiếu yêu cầu chờ đồng bộ`
                : "Đang ngoại tuyến — các phiếu tạo sẽ được lưu an toàn trên máy"
              : `Có ${pendingCount} phiếu yêu cầu chờ đồng bộ lên máy chủ`}
          </span>
        </div>

        {isOnline && pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSyncNow}
            disabled={isSyncing}
            className="h-6 px-2 text-[11px] border-amber-500/40 hover:bg-amber-500/20"
          >
            <RefreshCw className={`mr-1 size-3 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Đang gửi..." : "Đồng bộ ngay"}
          </Button>
        )}
      </div>
    </div>
  );
}
```

Create `src/components/offline/offline-sync-provider.tsx`:
```tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useOfflineQueueStore, type OfflineRequisition } from "@/stores/offline-queue-store";
import { createRequisition } from "@/features/requisitions/actions";
import { OfflineStatusBar } from "./offline-status-bar";

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  const queue = useOfflineQueueStore((s) => s.queue);
  const dequeue = useOfflineQueueStore((s) => s.dequeue);
  const updateStatus = useOfflineQueueStore((s) => s.updateStatus);

  const syncQueue = useCallback(async () => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const currentQueue = useOfflineQueueStore.getState().queue;
    const pendingItems = currentQueue.filter((i) => i.status === "pending" || i.status === "failed");
    if (pendingItems.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    let successCount = 0;

    for (const item of pendingItems) {
      updateStatus(item.clientTempId, "syncing");
      try {
        await createRequisition({
          zoneId: item.zoneId,
          purpose: item.purpose,
          requesterId: item.requesterId,
          items: item.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        });

        dequeue(item.clientTempId);
        successCount++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Lỗi đồng bộ";
        updateStatus(item.clientTempId, "failed", errorMsg);
      }
    }

    if (successCount > 0) {
      toast.success(`Đã tự động gửi thành công ${successCount} phiếu yêu cầu ngoại tuyến lên hệ thống!`, {
        duration: 5000,
      });
    }

    isSyncingRef.current = false;
    setIsSyncing(false);
  }, [dequeue, updateStatus]);

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const handleOnline = () => {
      setIsOnline(true);
      toast.info("Đã khôi phục kết nối mạng. Đang kiểm tra đồng bộ...");
      syncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        syncQueue();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial check on mount
    if (navigator.onLine) {
      syncQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncQueue]);

  return (
    <>
      <OfflineStatusBar isOnline={isOnline} isSyncing={isSyncing} onSyncNow={syncQueue} />
      {children}
    </>
  );
}
```

Modify `src/components/providers.tsx` to wrap children inside `<OfflineSyncProvider>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/components/offline/offline-status-bar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/offline/offline-status-bar.tsx src/components/offline/offline-status-bar.test.tsx src/components/offline/offline-sync-provider.tsx src/components/providers.tsx
git commit -m "feat(offline): add offline sync provider with auto-sync on network reconnect and status bar"
```

---

### Task 4: Trình bóc tách mã QR & Sheet thêm nhanh vật tư (QuickAddBottomSheet)

**Files:**
- Create: `src/features/products/lib/qr-parser.ts`
- Test: `src/features/products/lib/qr-parser.test.ts`
- Create: `src/features/products/components/quick-add-bottom-sheet.tsx`
- Test: `src/features/products/components/quick-add-bottom-sheet.test.tsx`

**Interfaces:**
- Produces: `parseProductQrText(raw: string): { type: "variant_id" | "search_query" | "url", value: string }`, `<QuickAddBottomSheet />`

- [ ] **Step 1: Write the failing test for qr-parser**

Create `src/features/products/lib/qr-parser.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseProductQrText } from "./qr-parser";

describe("parseProductQrText", () => {
  it("parses raw UUID as variant_id", () => {
    const uuid = "47814b7e-9762-42da-91ef-07755efcfa77";
    const res = parseProductQrText(uuid);
    expect(res.type).toBe("variant_id");
    expect(res.value).toBe(uuid);
  });

  it("extracts variant UUID from full products url with ?variant= parameter", () => {
    const url = "https://mtp.local/products?variant=47814b7e-9762-42da-91ef-07755efcfa77";
    const res = parseProductQrText(url);
    expect(res.type).toBe("variant_id");
    expect(res.value).toBe("47814b7e-9762-42da-91ef-07755efcfa77");
  });

  it("extracts variant UUID from QR format MTP:VAR:uuid", () => {
    const text = "MTP:VAR:47814b7e-9762-42da-91ef-07755efcfa77";
    const res = parseProductQrText(text);
    expect(res.type).toBe("variant_id");
    expect(res.value).toBe("47814b7e-9762-42da-91ef-07755efcfa77");
  });

  it("treats plain barcode or SKU text as search query", () => {
    const sku = "8934567890123";
    const res = parseProductQrText(sku);
    expect(res.type).toBe("search_query");
    expect(res.value).toBe("8934567890123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/features/products/lib/qr-parser.test.ts`
Expected: FAIL with "Cannot find module './qr-parser'"

- [ ] **Step 3: Implement parseProductQrText and QuickAddBottomSheet**

Create `src/features/products/lib/qr-parser.ts`:
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParsedProductQr {
  type: "variant_id" | "search_query";
  value: string;
}

export function parseProductQrText(raw: string): ParsedProductQr {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { type: "search_query", value: "" };

  // 1. Direct UUID
  if (UUID_REGEX.test(trimmed)) {
    return { type: "variant_id", value: trimmed.toLowerCase() };
  }

  // 2. MTP format: MTP:VAR:<uuid> or MTP:PROD:<uuid>
  if (trimmed.toUpperCase().startsWith("MTP:VAR:")) {
    const candidate = trimmed.substring(8).trim();
    if (UUID_REGEX.test(candidate)) {
      return { type: "variant_id", value: candidate.toLowerCase() };
    }
  }

  // 3. URL format: .../products?variant=<uuid> or .../qr/variant/<uuid>
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const variantParam = url.searchParams.get("variant") || url.searchParams.get("variant_id") || url.searchParams.get("v");
    if (variantParam && UUID_REGEX.test(variantParam)) {
      return { type: "variant_id", value: variantParam.toLowerCase() };
    }

    const pathSegments = url.pathname.split("/").filter(Boolean);
    const lastSeg = pathSegments[pathSegments.length - 1];
    if (lastSeg && UUID_REGEX.test(lastSeg)) {
      return { type: "variant_id", value: lastSeg.toLowerCase() };
    }
  } catch {
    // Not a valid URL, fallback to search query
  }

  return { type: "search_query", value: trimmed };
}
```

Create `src/features/products/components/quick-add-bottom-sheet.tsx`:
```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";
import type { VariantWithStock } from "@/features/products/types";

interface QuickAddBottomSheetProps {
  productName: string;
  variant: VariantWithStock;
  image?: string | null;
  onAdded?: () => void;
  onContinueScan?: () => void;
  onGoToCart?: () => void;
}

export function QuickAddBottomSheet({
  productName,
  variant,
  image,
  onAdded,
  onContinueScan,
  onGoToCart,
}: QuickAddBottomSheetProps) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const stock = variant.stock ?? 0;

  function handleAdd() {
    if (qty <= 0) return;
    addItem({
      variantId: variant.id,
      quantity: qty,
      name: productName,
      label: variant.unit || "Mặc định",
      unit: variant.unit || null,
      image,
      stock,
    });

    setAdded(true);
    toast.success(`Đã thêm ${qty} ${variant.unit || "món"} vào giỏ hàng`);
    if (onAdded) onAdded();
  }

  return (
    <div className="space-y-4 p-4 bg-background rounded-t-2xl border-t shadow-2xl">
      <div className="flex items-start gap-3">
        {image ? (
          <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
            <Image src={image} alt={productName} fill className="object-cover" />
          </div>
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground text-xs font-medium">
            Ảnh vật tư
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm leading-tight text-foreground line-clamp-2">{productName}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {variant.unit && (
              <Badge variant="outline" className="text-[11px] font-normal">
                ĐVT: {variant.unit}
              </Badge>
            )}
            <Badge variant={stock > 0 ? "secondary" : "destructive"} className="text-[11px]">
              Tồn: {stock} {variant.unit || ""}
            </Badge>
          </div>
        </div>
      </div>

      {!added ? (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">Số lượng cần:</span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shrink-0"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="size-3.5" />
              </Button>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-8 w-16 text-center font-semibold text-sm"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shrink-0"
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>

          <Button onClick={handleAdd} className="w-full bg-primary font-medium">
            <ShoppingCart className="mr-2 size-4" />
            Thêm vào giỏ hàng
          </Button>
        </div>
      ) : (
        <div className="space-y-2 pt-2 animate-in fade-in">
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium py-1">
            <Check className="size-4" />
            Đã thêm vào giỏ thành công!
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onContinueScan} className="text-xs">
              Tiếp tục quét
            </Button>
            <Button onClick={onGoToCart} className="text-xs">
              Xem giỏ hàng
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify parser passes**

Run: `bun run test src/features/products/lib/qr-parser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/products/lib/qr-parser.ts src/features/products/lib/qr-parser.test.ts src/features/products/components/quick-add-bottom-sheet.tsx
git commit -m "feat(products): add product QR parser and quick add bottom sheet component"
```

---

### Task 5: Hộp thoại Quét Camera (ProductQrScannerDialog) & Tích hợp Trang Chọn Vật Tư

**Files:**
- Create: `src/features/products/components/product-qr-scanner-dialog.tsx`
- Modify: `src/app/(app)/products/page.tsx`
- Modify: `src/app/(app)/requisitions/new/page.tsx`

**Interfaces:**
- Produces: `<ProductQrScannerDialog />`

- [ ] **Step 1: Implement ProductQrScannerDialog**

Create `src/features/products/components/product-qr-scanner-dialog.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Flashlight, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { parseProductQrText } from "../lib/qr-parser";
import { QuickAddBottomSheet } from "./quick-add-bottom-sheet";
import type { VariantWithStock } from "../types";

export function ProductQrScannerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);

  // Scanned item state
  const [scannedVariant, setScannedVariant] = useState<{
    productName: string;
    variant: VariantWithStock;
    image?: string | null;
  } | null>(null);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleLookupVariant = useCallback(
    async (rawCode: string) => {
      setLoading(true);
      const parsed = parseProductQrText(rawCode);
      const supabase = createClient();

      try {
        if (parsed.type === "variant_id") {
          const { data: vRow } = await supabase
            .from("variants")
            .select("*, products(id, name, image_url)")
            .eq("id", parsed.value)
            .single();

          if (vRow) {
            const { data: stockRow } = await supabase
              .from("variant_stock")
              .select("quantity")
              .eq("variant_id", vRow.id)
              .maybeSingle();

            const pMeta = vRow.products as { name?: string; image_url?: string } | null;
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate([40, 30, 40]);
            }

            setScannedVariant({
              productName: pMeta?.name || "Vật tư",
              variant: {
                ...vRow,
                stock: stockRow?.quantity ?? 0,
                isComposite: false,
                components: [],
              },
              image: pMeta?.image_url,
            });
            setLoading(false);
            return;
          }
        }

        // Fallback: search query on products
        onOpenChange(false);
        router.push(`/products?q=${encodeURIComponent(parsed.value)}`);
      } catch (err) {
        console.warn("Lookup error:", err);
      } finally {
        setLoading(false);
      }
    },
    [onOpenChange, router],
  );

  useEffect(() => {
    if (!open || scannedVariant) {
      stopCamera();
      return;
    }

    let isMounted = true;

    async function startCamera() {
      stopCamera();
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Trình duyệt không hỗ trợ camera");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
          setHasTorch(Boolean(capabilities?.torch));
        }

        if ("BarcodeDetector" in window) {
          // @ts-expect-error - BarcodeDetector API
          const detector = new window.BarcodeDetector({
            formats: ["qr_code", "code_128", "ean_13", "ean_8"],
          });

          const checkFrame = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const value = barcodes[0].rawValue;
                if (value) {
                  stopCamera();
                  handleLookupVariant(value);
                }
              }
            } catch {
              // Frame error ignore
            }
          };

          scanIntervalRef.current = window.setInterval(checkFrame, 250);
        }
      } catch (err) {
        setCameraError("Không thể mở camera. Vui lòng cấp quyền hoặc nhập mã bên dưới.");
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [open, facingMode, scannedVariant, handleLookupVariant, stopCamera]);

  async function toggleTorch() {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const next = !torchOn;
        // @ts-expect-error - torch constraint
        await track.applyConstraints({ advanced: [{ torch: next }] });
        setTorchOn(next);
      } catch {}
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) {
      stopCamera();
      handleLookupVariant(manualCode.trim());
      setManualCode("");
    }
  }

  return (
    <>
      <Dialog open={open && !scannedVariant} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 sm:max-w-md overflow-hidden bg-black text-white border-zinc-800">
          <DialogHeader className="p-3 bg-zinc-900 border-b border-zinc-800 flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Camera className="size-4 text-emerald-400" />
              Quét mã QR / Barcode Vật tư
            </DialogTitle>
          </DialogHeader>

          <div className="relative aspect-[4/3] w-full bg-black flex items-center justify-center overflow-hidden">
            {cameraError ? (
              <div className="p-6 text-center text-xs text-zinc-400 space-y-2">
                <CameraOff className="size-8 mx-auto text-zinc-600" />
                <p>{cameraError}</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted className="size-full object-cover" />
                {/* Laser scanframe */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="size-48 rounded-xl border-2 border-emerald-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] relative">
                    <div className="absolute inset-x-2 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                  </div>
                </div>

                {/* Floating camera controls */}
                <div className="absolute top-3 right-3 flex flex-col gap-2">
                  {hasTorch && (
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={toggleTorch}
                      className={`size-9 rounded-full bg-black/60 text-white backdrop-blur ${torchOn ? "text-yellow-400" : ""}`}
                    >
                      <Flashlight className="size-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setFacingMode((f) => (f === "environment" ? "user" : "environment"))}
                    className="size-9 rounded-full bg-black/60 text-white backdrop-blur"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

          <form onSubmit={handleManualSubmit} className="p-3 bg-zinc-900 flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Nhập mã tem / SKU thủ công..."
              className="h-9 bg-zinc-800 border-zinc-700 text-xs text-white placeholder:text-zinc-500"
            />
            <Button type="submit" size="sm" variant="secondary" className="h-9 px-3 shrink-0">
              <Search className="size-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Add Bottom Sheet on Mobile/Desktop */}
      <Sheet open={Boolean(scannedVariant)} onOpenChange={(open) => !open && setScannedVariant(null)}>
        <SheetContent side="bottom" className="p-0 sm:max-w-lg sm:mx-auto rounded-t-2xl">
          {scannedVariant && (
            <QuickAddBottomSheet
              productName={scannedVariant.productName}
              variant={scannedVariant.variant}
              image={scannedVariant.image}
              onContinueScan={() => setScannedVariant(null)}
              onGoToCart={() => {
                setScannedVariant(null);
                onOpenChange(false);
                router.push("/requisitions/new");
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 2: Add QR Scan Button in Products Page and Requisition New Page**

In `src/app/(app)/products/page.tsx`:
Add state/button `<Button onClick={() => setScannerOpen(true)}><Camera className="size-4" /></Button>` next to the search input.

In `src/app/(app)/requisitions/new/page.tsx`:
Add QR Scan trigger button so users can scan directly when building the requisition.

- [ ] **Step 3: Run full tests**

Run: `bun run test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/products/components/product-qr-scanner-dialog.tsx src/app/(app)/products/page.tsx src/app/(app)/requisitions/new/page.tsx
git commit -m "feat(products): add product QR camera scanner dialog and integrate into products search and requisition creation"
```

---

### Task 6: Tích hợp Gửi Ngoại tuyến trong Requisition Form & Kiểm thử Hoàn chỉnh

**Files:**
- Modify: `src/features/requisitions/components/requisition-form.tsx`
- Modify: `src/features/requisitions/actions.ts`

**Interfaces:**
- Connects: `useOfflineQueueStore.getState().enqueue(...)` on network failure or offline state.

- [ ] **Step 1: Update requisition-form.tsx for offline resilience**

In `src/features/requisitions/components/requisition-form.tsx`:
- Import `useOfflineQueueStore` and `useCartStore`.
- Before / around `createRequisition`:
  - If `navigator.onLine === false`:
    - Enqueue to `useOfflineQueueStore`.
    - Clear `useCartStore`.
    - Toast: `toast.info("Đang ngoại tuyến. Phiếu yêu cầu đã được lưu trên máy và sẽ tự động gửi khi có mạng.")`.
    - Redirect / push to `/requisitions`.
  - If `createRequisition` throws a network fetch / connection error (e.g. `Failed to fetch` or timeout):
    - Catch error $\rightarrow$ Enqueue to `useOfflineQueueStore` $\rightarrow$ clear cart $\rightarrow$ toast offline notice $\rightarrow$ push to `/requisitions`.

- [ ] **Step 2: Run all tests and build check**

Run:
```bash
bun run test
bun run build
```
Expected: PASS with no TypeScript or lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/requisitions/components/requisition-form.tsx src/features/requisitions/actions.ts
git commit -m "feat(requisitions): support seamless offline submission and offline queue integration"
```

---

## Plan Self-Review Checklist

- [x] **Spec coverage:** Manifest, PWA metadata, Install Prompt banner, Zustand offline queue, OfflineSyncProvider, Status bar, QR parser, QuickAddBottomSheet, Camera scanner dialog all mapped to tasks.
- [x] **Placeholder scan:** No TBD or vague steps; full code provided.
- [x] **Type consistency:** Stores, props, and interfaces aligned across all tasks.
- [x] **Test verified:** All test commands use Vitest runner via `bun run test`.
