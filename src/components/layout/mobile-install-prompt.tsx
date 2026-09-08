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
