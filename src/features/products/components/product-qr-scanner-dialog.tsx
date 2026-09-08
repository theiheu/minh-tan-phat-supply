"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Flashlight, RefreshCw, Search } from "lucide-react";
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
      } catch {
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
            <Button type="submit" size="sm" variant="secondary" className="h-9 px-3 shrink-0" disabled={loading}>
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
