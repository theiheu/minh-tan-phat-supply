"use client";

import { AttributesEditor } from "./attributes-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Bộ field chung cho 1 dòng biến thể: thuộc tính (key–value), giá, đơn vị, tồn tối thiểu, theo lô. */
export function VariantFields({
  pairs,
  onPairs,
  price,
  onPrice,
  unit,
  onUnit,
  minStock,
  onMinStock,
  isTrackableLot,
  onTrackableLot,
  idPrefix,
  showAttributes = true,
}: {
  pairs: [string, string][];
  onPairs: (pairs: [string, string][]) => void;
  price: string;
  onPrice: (v: string) => void;
  unit: string;
  onUnit: (v: string) => void;
  minStock: string;
  onMinStock: (v: string) => void;
  isTrackableLot: boolean;
  onTrackableLot: (v: boolean) => void;
  idPrefix?: string;
  /** Ẩn khối thuộc tính (dùng cho vật tư lẻ 1 quy cách). */
  showAttributes?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {showAttributes && (
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Quy cách / thuộc tính</Label>
          <AttributesEditor pairs={pairs} onChange={onPairs} compact />
          <p className="text-[11px] text-muted-foreground">
            VD: Kích cỡ → 39–42. Vật tư 1 quy cách để trống, chỉ cần Đơn vị bên dưới.
          </p>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs" htmlFor={idPrefix ? `${idPrefix}-price` : undefined}>
          Giá
        </Label>
        <Input id={idPrefix ? `${idPrefix}-price` : undefined} type="number" min="0" value={price} onChange={(e) => onPrice(e.target.value)} placeholder="đ" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor={idPrefix ? `${idPrefix}-unit` : undefined}>
          Đơn vị
        </Label>
        <Input id={idPrefix ? `${idPrefix}-unit` : undefined} value={unit} onChange={(e) => onUnit(e.target.value)} placeholder="VD: Bao, Cái, Bộ" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor={idPrefix ? `${idPrefix}-minstock` : undefined}>
          Tồn tối thiểu
        </Label>
        <Input id={idPrefix ? `${idPrefix}-minstock` : undefined} type="number" min="0" value={minStock} onChange={(e) => onMinStock(e.target.value)} />
      </div>
      <div className="flex items-end pb-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={isTrackableLot}
            onChange={(e) => onTrackableLot(e.target.checked)}
            className="size-4 accent-primary"
          />
          Theo lô / hạn dùng
        </label>
      </div>
    </div>
  );
}
