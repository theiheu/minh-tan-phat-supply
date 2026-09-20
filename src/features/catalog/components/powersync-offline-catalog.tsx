"use client";

import { useState } from "react";
import { Search, Package, Database } from "lucide-react";
import { usePowerSyncCatalog, type PowerSyncCatalogItem } from "@/lib/powersync/hooks";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function PowerSyncOfflineCatalog({
  onSelectSku,
}: {
  onSelectSku?: (item: PowerSyncCatalogItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { items, isLoading } = usePowerSyncCatalog({ q: query, activeOnly: true });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Database className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span>Tra cứu Kho Ngoại tuyến</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-4">
        <SheetHeader className="pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Package className="size-5 text-primary" />
            Tra Cứu Vật Tư Ngoại Tuyến (SQLite)
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Dữ liệu được lưu trữ và truy vấn 100% cục bộ trên thiết bị, hoạt động ngay cả khi mất sóng.
          </p>
        </SheetHeader>

        <div className="relative my-3">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên vật tư, mã SKU, danh mục..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
              Đang truy vấn SQLite cục bộ...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {query ? "Không tìm thấy vật tư phù hợp trong bộ nhớ cục bộ" : "Chưa có dữ liệu vật tư"}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (onSelectSku) {
                    onSelectSku(item);
                    setOpen(false);
                  }
                }}
                className="p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer bg-card hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">
                      {item.product_name || item.name}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                      <span>Mã: <code className="font-mono font-semibold">{item.sku_code || item.code || "N/A"}</code></span>
                      {item.base_unit_name && (
                        <span>• ĐVT: {item.base_unit_name}</span>
                      )}
                    </div>
                  </div>
                  {item.category_name && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {item.category_name}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
