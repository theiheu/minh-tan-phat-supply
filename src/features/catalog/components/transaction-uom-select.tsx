"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientGetTransactionUoms } from "../actions";
import type { TransactionUom } from "../domain/types";

interface TransactionUomSelectProps {
  skuId: string;
  value?: string;
  onValueChange?: (unitId: string) => void;
  onUomChange?: (uom: TransactionUom | undefined) => void;
  disabled?: boolean;
  className?: string;
  requireFraction?: boolean;
  placeholder?: string;
}

export function TransactionUomSelect({
  skuId,
  value,
  onValueChange,
  onUomChange,
  disabled,
  className,
  requireFraction,
  placeholder = "Chọn ĐVT",
}: TransactionUomSelectProps) {
  const { data: uoms, isLoading } = useQuery({
    queryKey: ["catalog:uoms", skuId],
    queryFn: () => clientGetTransactionUoms(skuId),
    staleTime: 60000,
    enabled: Boolean(skuId),
  });

  const filtered = uoms?.filter((u) => {
    if (requireFraction && !u.allowFraction) return false;
    return true;
  });

  const handleSelect = (selectedId: string) => {
    onValueChange?.(selectedId);
    if (onUomChange) {
      const found = filtered?.find((u) => u.id === selectedId);
      onUomChange(found);
    }
  };

  return (
    <Select value={value} onValueChange={handleSelect} disabled={disabled || isLoading || !skuId}>
      <SelectTrigger className={className}>
        {isLoading ? (
          <span className="flex items-center gap-2 text-muted-foreground w-full">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span className="truncate text-xs">Đang tải...</span>
          </span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {filtered?.map((uom) => (
          <SelectItem key={uom.id} value={uom.id}>
            {uom.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
