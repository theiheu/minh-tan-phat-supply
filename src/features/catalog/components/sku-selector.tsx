// src/features/catalog/components/sku-selector.tsx
"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { clientResolveBarcode, clientSearchSkus } from "../actions";
import type { SkuSelectOption } from "../domain/types";

interface SkuSelectorProps {
  value?: string; // skuId
  onSelect: (sku: SkuSelectOption) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  excludeSkuIds?: string[];
  requireInventoryPolicy?: "virtual_kit" | "stocked_assembly" | "normal";
  placeholder?: string;
}

export function SkuSelector({
  value,
  onSelect,
  disabled,
  autoFocus,
  className,
  excludeSkuIds = [],
  requireInventoryPolicy,
  placeholder = "Tìm tên, mã SKU hoặc quét mã QR...",
}: SkuSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: skus, isLoading } = useQuery({
    queryKey: ["catalog:search", search],
    queryFn: async () => {
      const q = search.trim();
      if (!q) return clientSearchSkus("", 50);
      const barcodeRes = await clientResolveBarcode(q);
      if (barcodeRes?.skuId) {
        const direct = await clientSearchSkus(barcodeRes.skuId, 1);
        if (direct.length > 0) return direct;
      }
      return clientSearchSkus(q, 30);
    },
    staleTime: 10000,
  });

  const filtered = useMemo(() => {
    if (!skus) return [];
    return skus.filter((s) => {
      if (excludeSkuIds.includes(s.skuId)) return false;
      if (requireInventoryPolicy && s.inventoryPolicy !== requireInventoryPolicy) return false;
      return true;
    });
  }, [skus, excludeSkuIds, requireInventoryPolicy]);

  const selected = value ? filtered.find((s) => s.skuId === value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn("w-full justify-between font-normal text-left h-auto min-h-10 py-2", className, !selected && "text-muted-foreground")}
        >
          {selected ? (
            <div className="flex flex-col gap-0.5 truncate">
              <span className="truncate break-all font-medium whitespace-normal">{selected.productName}</span>
              {selected.summary && selected.summary !== "SKU" && (
                <span className="truncate break-all text-xs text-muted-foreground whitespace-normal">{selected.summary}</span>
              )}
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Gõ tên hoặc quét mã..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tìm...
                </span>
              ) : (
                "Không tìm thấy SKU phù hợp."
              )}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((sku) => (
                <CommandItem
                  key={sku.skuId}
                  value={sku.skuId}
                  onSelect={(v) => {
                    const found = filtered.find((f) => f.skuId === v);
                    if (found) {
                      onSelect(found);
                      setOpen(false);
                      setSearch("");
                    }
                  }}
                  className="flex flex-col items-start gap-1 py-2 px-3 border-b last:border-0"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="font-semibold">{sku.productName}</span>
                    {value === sku.skuId && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  </div>
                  {sku.summary !== "SKU" && <span className="text-sm text-muted-foreground line-clamp-2">{sku.summary}</span>}
                  <div className="flex w-full items-center justify-between gap-2 mt-1">
                    <div className="flex gap-1.5 font-mono text-[11px]">
                      <span className="bg-muted px-1.5 py-0.5 rounded border border-border/50 text-foreground font-semibold">{sku.skuCode}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-medium h-5">
                      Tồn: {sku.availableOnHand} {sku.baseUnitSymbol}
                    </Badge>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}