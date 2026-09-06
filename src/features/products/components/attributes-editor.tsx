"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Bộ khóa–giá trị mô tả quy cách/biến thể (thay cho ô nhập JSON thô). */
export function AttributesEditor({
  pairs,
  onChange,
  className,
  keyPlaceholder = "Tên thuộc tính (VD: Kích cỡ)",
  valuePlaceholder = "Giá trị (VD: 39–42)",
  compact,
}: {
  pairs: [string, string][];
  onChange: (pairs: [string, string][]) => void;
  className?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  compact?: boolean;
}) {
  function setRow(i: number, patch: [string, string]) {
    onChange(pairs.map((p, idx) => (idx === i ? patch : p)));
  }

  function addRow() {
    onChange([...pairs, ["", ""]]);
  }

  function removeRow(i: number) {
    onChange(pairs.filter((_, idx) => idx !== i));
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {pairs.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            value={k}
            onChange={(e) => setRow(i, [e.target.value, v])}
            placeholder={keyPlaceholder}
            className={cn("h-8", compact ? "flex-1" : "w-[40%] min-w-24 flex-none")}
          />
          <Input
            value={v}
            onChange={(e) => setRow(i, [k, e.target.value])}
            placeholder={valuePlaceholder}
            className="h-8 min-w-0 flex-1"
          />
          {pairs.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeRow(i)}
              aria-label="Xóa dòng thuộc tính"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 px-2 text-xs">
        <Plus className="size-3.5" aria-hidden /> Thêm thuộc tính
      </Button>
    </div>
  );
}
