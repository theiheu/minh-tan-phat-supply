"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryIcon } from "@/components/category-icon";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryIconPicker } from "./category-icon-picker";

export interface CrudColumn {
  key: string;
  label: string;
  kind?: "text" | "select" | "icon";
  options?: { value: string; label: string }[];
}

export type CrudRow = { id: string; [key: string]: string | null };

/**
 * Gộp dữ liệu ô nhập với ô chưa chạm:
 * - Ô text chưa nhập → "" (để server báo "Tên không được trống" thay vì thiếu key).
 * - Ô select chưa chọn → bỏ key (để zod dùng default, vd type location = 'main').
 * - Khi sửa: ô không sửa → lấy giá trị dòng hiện tại (không làm mất dữ liệu cũ).
 */
function fullData(
  columns: CrudColumn[],
  touched: Record<string, string>,
  fallback?: CrudRow | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of columns) {
    const base = touched[c.key] ?? fallback?.[c.key] ?? "";
    // Select/icon bỏ qua khi chưa chọn (để zod dùng default, vd icon = 'other').
    if ((c.kind === "select" || c.kind === "icon") && base === "") continue;
    out[c.key] = base;
  }
  return out;
}

function Field({
  col,
  value,
  onChange,
}: {
  col: CrudColumn;
  value: string;
  onChange: (v: string) => void;
}) {
  if (col.kind === "icon") {
    return <CategoryIconPicker value={value} onChange={onChange} options={col.options ?? []} />;
  }
  if (col.kind === "select" && col.options) {
    return (
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={col.label} />
        </SelectTrigger>
        <SelectContent>
          {col.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={col.label} />;
}

function displayValue(col: CrudColumn, value: string | null): string {
  if (!value) return "—";
  if (col.kind === "select" && col.options) {
    return col.options.find((o) => o.value === value)?.label ?? value;
  }
  return value;
}

/** Nội dung ô trong bảng — cột icon hiện trực tiếp ảnh/icon, cột khác hiện text. */
function cellContent(col: CrudColumn, value: string | null) {
  if (col.kind === "icon") {
    return value ? (
      <span className="inline-flex items-center justify-center rounded-md border bg-muted/40 px-1.5 py-1">
        <CategoryIcon value={value} className="size-5" />
      </span>
    ) : (
      "—"
    );
  }
  return displayValue(col, value);
}

export function EntityCrud({
  title,
  items,
  columns,
  save,
  remove,
  page = 1,
  totalPages = 1,
  basePath,
  search = "",
  searchPlaceholder,
  emptyText,
  createMode = "inline",
}: {
  title: string;
  items: CrudRow[];
  columns: CrudColumn[];
  save: (id: string | null, data: Record<string, string>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Trang hiện tại (searchParams.page) — mặc định 1. */
  page?: number;
  /** Tổng số trang — mặc định 1 (ẩn phân trang). */
  totalPages?: number;
  /** Đường dẫn gốc cho phân trang (VD "/admin/categories"). */
  basePath: string;
  /** Từ khóa tìm kiếm đang áp dụng (searchParams.q) — rỗng = không tìm. */
  search?: string;
  /** Có truyền thì hiện ô tìm kiếm trên tiêu đề (VD "Tìm nhà cung cấp…"). */
  searchPlaceholder?: string;
  /** Thông báo khi danh sách rỗng (mặc định "Chưa có dữ liệu"). */
  emptyText?: string;
  /** Cách tạo mới: "inline" = form trên đầu thẻ; "modal" = chỉ nút Tạo mới, bấm mở modal form. */
  createMode?: "inline" | "modal";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState(search ?? "");

  // Đồng bộ ô tìm kiếm khi URL thay đổi (tìm mới, xóa lọc, back/forward).
  useEffect(() => {
    setQ(search ?? "");
  }, [search]);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term === (search ?? "")) return;
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    const s = params.toString();
    router.push(s ? `${basePath}?${s}` : basePath);
  }

  function clearSearch() {
    setQ("");
    router.push(basePath);
  }

  function run(action: () => Promise<void>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        setForm({});
        setEditId(null);
        setAddOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  const iconCols = columns.filter((c) => c.kind === "icon");
  const simpleCols = columns.filter((c) => c.kind !== "icon");
  const hasIcon = iconCols.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {(searchPlaceholder || createMode === "modal") && (
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
              {searchPlaceholder && (
                <form onSubmit={submitSearch} className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  <div className="relative w-full max-w-xs">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      className="h-9 pl-8"
                    />
                  </div>
                  <Button type="submit" size="sm" variant="outline">
                    Tìm
                  </Button>
                  {search && (
                    <Button type="button" size="sm" variant="ghost" onClick={clearSearch}>
                      Xóa
                    </Button>
                  )}
                </form>
              )}
              {createMode === "modal" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setForm({});
                    setAddOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Tạo mới
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {createMode === "inline" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => save(null, fullData(columns, form)), "Đã thêm");
            }}
            className={hasIcon ? "space-y-3" : "grid grid-cols-2 gap-2 sm:grid-cols-4"}
          >
          {hasIcon ? (
            <>
              <div className="flex flex-wrap items-end gap-2">
                {simpleCols.map((c) => (
                  <div key={c.key} className="min-w-40 flex-1 basis-52">
                    <Field
                      col={c}
                      value={form[c.key] ?? ""}
                      onChange={(v) => setForm((f) => ({ ...f, [c.key]: v }))}
                    />
                  </div>
                ))}
                <div className="flex items-end">
                  <Button type="submit" disabled={pending}>
                    Thêm
                  </Button>
                </div>
              </div>
              {iconCols.map((c) => (
                <div key={c.key} className="rounded-lg border bg-muted/20 p-3">
                  <p className="mb-2 text-sm font-medium">{c.label}</p>
                  <Field
                    col={c}
                    value={form[c.key] ?? ""}
                    onChange={(v) => setForm((f) => ({ ...f, [c.key]: v }))}
                  />
                </div>
              ))}
            </>
          ) : (
            <>
              {columns.map((c) => (
                <Field
                  key={c.key}
                  col={c}
                  value={form[c.key] ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, [c.key]: v }))}
                />
              ))}
              <div className="flex items-end">
                <Button type="submit" disabled={pending}>
                  Thêm
                </Button>
              </div>
            </>
          )}
          </form>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground">
                  {emptyText ?? "Chưa có dữ liệu"}
                </TableCell>
              </TableRow>
            )}
            {items.map((row) =>
              editId === row.id ? (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>
                      <Field
                        col={c}
                        value={editForm[c.key] ?? row[c.key] ?? ""}
                        onChange={(v) => setEditForm((f) => ({ ...f, [c.key]: v }))}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" onClick={() => run(() => save(row.id, fullData(columns, editForm, row)), "Đã lưu")} disabled={pending}>
                        Lưu
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                        Hủy
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>{cellContent(c, row[c.key])}</TableCell>
                  ))}
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditId(row.id);
                          setEditForm({});
                        }}
                      >
                        Sửa
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => run(() => remove(row.id), "Đã xóa")} disabled={pending}>
                        Xóa
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>

        <Pagination basePath={basePath} page={page} totalPages={totalPages} params={search ? { q: search } : undefined} />
      </CardContent>

      {createMode === "modal" && (
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) setForm({});
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Thêm {title.toLowerCase()}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => save(null, fullData(columns, form)), "Đã thêm");
              }}
            >
              <div className={hasIcon ? "space-y-3" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
                {simpleCols.map((c) => (
                  <label key={c.key} className={hasIcon ? "block min-w-40 flex-1 basis-52" : "block space-y-1.5"}>
                    <span className="mb-1.5 block text-sm font-medium">{c.label}</span>
                    <Field
                      col={c}
                      value={form[c.key] ?? ""}
                      onChange={(v) => setForm((f) => ({ ...f, [c.key]: v }))}
                    />
                  </label>
                ))}
                {iconCols.map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <span className="block text-sm font-medium">{c.label}</span>
                    <Field
                      col={c}
                      value={form[c.key] ?? ""}
                      onChange={(v) => setForm((f) => ({ ...f, [c.key]: v }))}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={pending}>
                  Hủy
                </Button>
                <Button type="submit" disabled={pending}>
                  Thêm
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
