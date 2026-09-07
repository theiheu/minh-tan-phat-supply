"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ComboboxInputOption {
  value: string;
  /** Dòng 1 — tên chính (ví dụ tên vật tư). */
  label: string;
  /** Dòng 2 nhỏ màu xám — chi tiết bổ sung (ví dụ biến thể · đơn vị). */
  detail?: string;
  /** Phụ chú bên phải (nếu có). */
  hint?: string;
  /** Chuỗi hiển thị trong ô sau khi chọn; mặc định = label. */
  text?: string;
}

const MAX_VISIBLE = 100;

/**
 * Ô chọn kiểu "gõ thẳng" (inline autocomplete): gõ trực tiếp vào ô để lọc
 * danh sách bên dưới — không cần bấm mở dropdown trước như SearchSelect.
 * - Chọn 1 dòng → ô hiện đúng tên đã chọn.
 * - Enter chọn khi còn đúng 1 kết quả (hoặc có kết quả khớp chính xác).
 * - Xoá hết chữ = bỏ lựa chọn (onChange("")).
 * - Bấm ra ngoài / Esc mà chưa chọn → trả lại lựa chọn đang có, không làm mất.
 */
export function ComboboxInput({
  value,
  onChange,
  options,
  placeholder = "Chọn…",
  emptyText = "Không tìm thấy.",
  inputClassName,
}: {
  value: string; // id đang chọn; "" = chưa chọn
  onChange: (value: string) => void; // "" = xoá lựa chọn
  options: ComboboxInputOption[];
  placeholder?: string;
  emptyText?: string;
  /** Class thêm vào ô nhập (vd h-12 để dễ bấm trên mobile). */
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  // Chuỗi hiển thị trong ô khi đã chọn (ưu tiên text, mặc định label).
  const chosenText = selected ? (selected.text ?? selected.label) : "";

  // Đồng bộ ô nhập với lựa chọn thay đổi từ ngoài (reset dòng, chọn xong…).
  useEffect(() => {
    setText(chosenText);
  }, [chosenText]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.detail ?? ""} ${o.hint ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, text]);

  const visible = filtered.slice(0, MAX_VISIBLE);
  const hiddenCount = filtered.length - visible.length;

  function revertQuery() {
    setText(chosenText);
  }

  function pick(option: ComboboxInputOption) {
    onChange(option.value);
    setText(option.text ?? option.label);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      revertQuery();
      setOpen(false);
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && open) {
      const q = text.trim().toLowerCase();
      const exact = filtered.find(
        (o) => o.label.toLowerCase() === q || (o.detail ?? "").toLowerCase() === q,
      );
      const target = exact ?? (filtered.length === 1 ? filtered[0] : undefined);
      if (target) {
        pick(target);
        e.preventDefault();
      }
    }
  }

  // Bấm ra ngoài → đóng danh sách (blur sẽ tự trả text về lựa chọn cũ).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <Input
        value={text}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (e.target.value === "") onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={revertQuery}
        onKeyDown={handleKeyDown}
        className={cn("pr-8 text-sm", inputClassName)}
      />
      <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50" />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-full w-max max-w-[min(90vw,560px)] overflow-hidden rounded-lg border-2 border-border bg-popover text-popover-foreground shadow-xl">
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
              {visible.map((o) => {
                const active = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-hidden",
                        active && "bg-accent/70 font-medium",
                      )}
                      // Giữ focus trong ô nhập để không kích hoạt blur/revert trước khi chọn.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(o)}
                    >
                      {active ? (
                        <Check className="size-4 shrink-0 text-primary mt-0.5" aria-hidden />
                      ) : (
                        <div className="size-4 shrink-0" />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col items-start">
                        <span className="w-full font-medium leading-snug break-words text-foreground">
                          {o.label}
                        </span>
                        {o.detail ? (
                          <span className="w-full text-xs text-muted-foreground mt-0.5 break-words">
                            {o.detail}
                          </span>
                        ) : null}
                      </span>
                      {o.hint ? (
                        <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground font-mono">
                          {o.hint}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {hiddenCount > 0 && (
                <li className="px-3 py-1.5 text-xs text-muted-foreground">
                  Còn {hiddenCount} kết quả khác — gõ thêm để thu hẹp danh sách…
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
