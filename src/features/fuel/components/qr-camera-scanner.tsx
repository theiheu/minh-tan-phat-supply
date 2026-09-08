"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, Flashlight, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QrCameraScanner({
  onScan,
  isScanning = true,
}: {
  onScan: (code: string) => void;
  isScanning?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [manualCode, setManualCode] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isScanning) {
      stopCamera();
      return;
    }

    let isMounted = true;

    async function startCamera() {
      stopCamera();
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Trình duyệt không hỗ trợ truy cập camera");
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Check torch capability
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
          setHasTorch(Boolean(capabilities?.torch));
        }

        // Setup barcode detector if available
        if ("BarcodeDetector" in window) {
          // @ts-expect-error - BarcodeDetector is a standard web API in modern browsers
          const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13"] });

          const checkFrame = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const value = barcodes[0].rawValue;
                if (value) {
                  onScan(value);
                  return;
                }
              }
            } catch {
              // ignore frame errors
            }
          };

          scanIntervalRef.current = window.setInterval(checkFrame, 250);
        }
      } catch (err) {
        console.warn("Camera access error:", err);
        setCameraError("Không thể mở camera. Vui lòng cấp quyền truy cập hoặc nhập mã xe bên dưới.");
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [facingMode, isScanning, onScan]);

  function stopCamera() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function toggleTorch() {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const next = !torchOn;
        // @ts-expect-error - torch constraint
        await track.applyConstraints({ advanced: [{ torch: next }] });
        setTorchOn(next);
      } catch {
        // Torch not supported on some platforms
      }
    }
  }

  function toggleCamera() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode("");
    }
  }

  return (
    <div className="space-y-4">
      {/* Video Viewport Container */}
      <div className="relative mx-auto aspect-video max-h-[380px] w-full max-w-lg overflow-hidden rounded-2xl bg-black shadow-xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className="size-full object-cover"
        />

        {/* Target scanning reticle overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="relative size-48 sm:size-56 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
            {/* Reticle corner accents */}
            <div className="absolute -top-1 -left-1 size-5 rounded-tl-lg border-t-4 border-l-4 border-emerald-400" />
            <div className="absolute -top-1 -right-1 size-5 rounded-tr-lg border-t-4 border-r-4 border-emerald-400" />
            <div className="absolute -bottom-1 -left-1 size-5 rounded-bl-lg border-b-4 border-l-4 border-emerald-400" />
            <div className="absolute -bottom-1 -right-1 size-5 rounded-br-lg border-b-4 border-r-4 border-emerald-400" />
            
            {/* Animated scan line */}
            <div className="absolute inset-x-2 top-2 h-0.5 animate-bounce bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          </div>
        </div>

        {/* Controls inside camera view */}
        <div className="absolute top-3 right-3 flex gap-2">
          {hasTorch && (
            <Button
              size="icon"
              variant={torchOn ? "default" : "secondary"}
              className="size-9 rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
              onClick={toggleTorch}
            >
              <Flashlight className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="secondary"
            className="size-9 rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
            onClick={toggleCamera}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>

        {/* Error overlay if camera fails */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center text-white backdrop-blur-sm">
            <CameraOff className="mb-2 size-10 text-amber-400" />
            <p className="text-xs text-muted-foreground">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Manual lookup input */}
      <form onSubmit={handleManualSubmit} className="mx-auto flex max-w-lg gap-2">
        <Input
          placeholder="Hoặc nhập Biển số xe / Mã máy (VD: 61C-123.45)"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          className="h-11 bg-background text-sm font-medium"
        />
        <Button type="submit" className="h-11 px-5">
          <Search className="mr-1.5 size-4" />
          Tìm xe
        </Button>
      </form>
    </div>
  );
}
