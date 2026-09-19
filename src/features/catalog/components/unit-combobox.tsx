"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CatalogUnit } from "../domain/types";

export interface UnitComboboxProps {
  value: string;
  onChange: (unitIdOrName: string, unit?: CatalogUnit) => void;
  units: CatalogUnit[];
  placeholder?: string;
  emptyText?: string;
  allowCustom?: boolean;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  id?: string;
  size?: "default" | "sm";
}

/**
 * Ô chọn / nhập đơn vị tính thông minh:
 * - Hiển thị tên đơn vị tính gọn gàng (ví dụ: "Hộp", "Cái", "Bộ" - không kèm ngoặc đơn symbol).
 * - Cho phép chọn nhanh từ danh mục đơn vị tính đã có trong hệ thống.
 * - Cho phép gõ trực tiếp tên đơn vị mới nếu chưa có trong danh sách.
 */
export function UnitCombobox({
  value,
  onChange,
  units,
  placeholder = "Chọn hoặc nhập ĐVT…",
  emptyText = "Không tìm thấy đơn vị phù hợp",
  allowCustom = true,
  className,
  inputClassName,
  disabled = false,
  id,
  size = "default",
}: UnitComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tìm unit hiện tại dựa theo value (value có thể là unit.id hoặc unit.name hoặc unit.code)
  const selectedUnit = useMemo(() => {
    if (!value) return null;
    return (
      units.find(
        (u) =>
          u.id === value ||
          u.name.toLowerCase() === value.toLowerCase() ||
          u.code.toLowerCase() === value.toLowerCase()
      ) ?? null
    );
  }, [units, value]);

  // Chuỗi hiển thị tên đơn vị (không kèm symbol trong ngoặc)
  const displayText = selectedUnit ? selectedUnit.name : value;

  // Đồng bộ query khi value thay đổi từ ngoài
  useEffect(() => {
    if (!open) {
      setQuery(displayText);
    }
  }, [displayText, open]);

  // Lọc danh sách theo query người dùng gõ
  const filteredUnits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.code.toLowerCase().includes(q) ||
        u.symbol.toLowerCase().includes(q)
    );
  }, [units, query]);

  // Kiểm tra xem query hiện tại đã có trong danh sách chưa
  const trimmedQuery = query.trim();
  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return true;
    const lower = trimmedQuery.toLowerCase();
    return units.some(
      (u) =>
        u.name.toLowerCase() === lower ||
        u.code.toLowerCase() === lower ||
        u.symbol.toLowerCase() === lower
    );
  }, [units, trimmedQuery]);

  function handleSelect(unit: CatalogUnit) {
    onChange(unit.id, unit);
    setQuery(unit.name);
    setOpen(false);
  }

  function handleSelectCustom(customName: string) {
    if (!customName.trim()) return;
    const trimmed = customName.trim();
    // Thử match lại xem có khớp với unit nào không
    const matched = units.find(
      (u) =>
        u.name.toLowerCase() === trimmed.toLowerCase() ||
        u.code.toLowerCase() === trimmed.toLowerCase() ||
        u.symbol.toLowerCase() === trimmed.toLowerCase()
    );
    if (matched) {
      onChange(matched.id, matched);
      setQuery(matched.name);
    } else {
      onChange(trimmed, undefined);
      setQuery(trimmed);
    }
    setOpen(false);
  }

  function handleBlur() {
    // Khi blur ra ngoài: nếu query khác rỗng và chưa chọn
    if (trimmedQuery && trimmedQuery !== displayText) {
      handleSelectCustom(trimmedQuery);
    } else if (!trimmedQuery && value) {
      onChange("");
      setQuery("");
    } else {
      setQuery(displayText);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQuery(displayText);
      setOpen(false);
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredUnits.length === 1 && !trimmedQuery) {
        handleSelect(filteredUnits[0]);
      } else if (trimmedQuery) {
        const exact = filteredUnits.find(
          (u) =>
            u.name.toLowerCase() === trimmedQuery.toLowerCase() ||
            u.code.toLowerCase() === trimmedQuery.toLowerCase()
        );
        if (exact) {
          handleSelect(exact);
        } else if (allowCustom) {
          handleSelectCustom(trimmedQuery);
        } else if (filteredUnits.length > 0) {
          handleSelect(filteredUnits[0]);
        }
      }
    }
  }

  // Đóng dropdown khi bấm bên ngoài
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <Input
          id={id}
          ref={inputRef}
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (e.target.value === "") {
              onChange("");
            }
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "pr-8 text-foreground",
            size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
            inputClassName
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              inputRef.current?.focus();
              setOpen(true);
            }
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Mở danh sách đơn vị tính"
        >
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 min-w-[200px] w-full overflow-hidden rounded-lg border-2 border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1 space-y-0.5">
            {/* Tùy chọn thêm đơn vị tính mới nếu người dùng gõ từ chưa có */}
            {allowCustom && trimmedQuery && !hasExactMatch && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectCustom(trimmedQuery)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer border-b border-border/50 pb-2 mb-1"
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span>Sử dụng đơn vị mới: <strong className="underline font-bold text-foreground">&ldquo;{trimmedQuery}&rdquo;</strong></span>
                </button>
              </li>
            )}

            {filteredUnits.length === 0 && !trimmedQuery ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                {emptyText}
              </li>
            ) : filteredUnits.length === 0 && hasExactMatch ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                {emptyText}
              </li>
            ) : (
              filteredUnits.map((u) => {
                const isSelected = selectedUnit?.id === u.id || value === u.id || value.toLowerCase() === u.name.toLowerCase();
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(u)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer select-none",
                        size === "sm" ? "text-xs" : "text-sm",
                        isSelected && "bg-accent/80 font-semibold text-accent-foreground"
                      )}
                    >
                      <span className="truncate">{u.name}</span>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-auto" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
