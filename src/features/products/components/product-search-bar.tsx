"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductQrScannerDialog } from "./product-qr-scanner-dialog";

export function ProductSearchBar({
  defaultValue = "",
  categoryId = null,
}: {
  defaultValue?: string;
  categoryId?: string | null;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <>
      <form method="get" className="mx-auto flex w-full max-w-xl gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Tìm vật tư…"
          className="flex-1"
        />
        {categoryId ? <input type="hidden" name="category" value={categoryId} /> : null}
        <Button type="submit" variant="outline" className="shrink-0">
          Tìm
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setScannerOpen(true)}
          className="shrink-0"
          title="Quét mã QR / Barcode"
          aria-label="Quét mã QR"
        >
          <Camera className="size-4 text-primary" />
        </Button>
      </form>

      <ProductQrScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} />
    </>
  );
}
