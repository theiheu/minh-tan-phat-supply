"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface LowStockItem {
  id: string;
  skuCode: string;
  productName: string;
  currentStock: number;
  minStock: number;
  unit: string;
  locationName?: string;
}

interface LowStockAlertCardProps {
  items: LowStockItem[];
  className?: string;
}

export function LowStockAlertCard({ items, className }: LowStockAlertCardProps) {
  if (items.length === 0) return null;

  return (
    <Card className={`border-amber-200 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-500/5 rounded-xl ${className || ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-sm sm:text-base font-semibold text-amber-900 dark:text-amber-200">
            Cảnh báo tồn kho tối thiểu ({items.length})
          </CardTitle>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
        >
          Xem kho
          <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pt-0 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-500/20 bg-background/80 text-xs"
            >
              <div className="min-w-0 pr-2">
                <div className="font-semibold text-foreground truncate">{item.productName}</div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">{item.skuCode}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {item.currentStock} / {item.minStock} {item.unit}
                </div>
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-700 dark:text-amber-300">
                  {item.currentStock === 0 ? "Hết hàng" : "Sắp hết"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
