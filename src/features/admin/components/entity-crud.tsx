"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export interface CrudColumn {
  key: string;
  label: string;
  kind?: "text" | "select";
  options?: { value: string; label: string }[];
}

export type CrudRow = { id: string; [key: string]: string | null };

function Field({
  col,
  value,
  onChange,
}: {
  col: CrudColumn;
  value: string;
  onChange: (v: string) => void;
}) {
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

export function EntityCrud({
  title,
  items,
  columns,
  save,
  remove,
}: {
  title: string;
  items: CrudRow[];
  columns: CrudColumn[];
  save: (id: string | null, data: Record<string, string>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  function run(action: () => Promise<void>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        setForm({});
        setEditId(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => save(null, form), "Đã thêm");
          }}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {columns.map((c) => (
            <Field key={c.key} col={c} value={form[c.key] ?? ""} onChange={(v) => setForm((f) => ({ ...f, [c.key]: v }))} />
          ))}
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              Thêm
            </Button>
          </div>
        </form>

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
                  Chưa có dữ liệu
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
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => run(() => save(row.id, editForm), "Đã lưu")} disabled={pending}>
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
                    <TableCell key={c.key}>{displayValue(c, row[c.key])}</TableCell>
                  ))}
                  <TableCell>
                    <div className="flex gap-1">
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
      </CardContent>
    </Card>
  );
}
