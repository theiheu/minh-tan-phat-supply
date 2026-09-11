"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Loader2, MapPin, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/pagination";
import { deleteZone, saveZoneWithSubZones } from "../actions";

export interface SubZoneItem {
  id: string;
  name: string;
  display_order?: number;
}

export interface ZoneItem {
  id: string;
  name: string;
  description: string | null;
  subZones: SubZoneItem[];
}

export function ZoneManager({
  zones,
  page,
  totalPages,
  basePath = "/admin/zones",
}: {
  zones: ZoneItem[];
  page: number;
  totalPages: number;
  basePath?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ZoneItem | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subZones, setSubZones] = useState<string[]>([]);
  const [subZoneInput, setSubZoneInput] = useState("");

  // Delete confirm state
  const [deleteConfirmZone, setDeleteConfirmZone] = useState<ZoneItem | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreateDialog() {
    setEditingZone(null);
    setName("");
    setDescription("");
    setSubZones([]);
    setSubZoneInput("");
    setDialogOpen(true);
  }

  function openEditDialog(zone: ZoneItem) {
    setEditingZone(zone);
    setName(zone.name);
    setDescription(zone.description ?? "");
    setSubZones(zone.subZones.map((s) => s.name));
    setSubZoneInput("");
    setDialogOpen(true);
  }

  function handleAddSubZone() {
    const trimmed = subZoneInput.trim();
    if (!trimmed) return;
    if (subZones.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Trại/xưởng "${trimmed}" đã có trong danh sách`);
      return;
    }
    setSubZones([...subZones, trimmed]);
    setSubZoneInput("");
  }

  function handleRemoveSubZone(index: number) {
    setSubZones(subZones.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên khu vực");
      return;
    }

    startTransition(async () => {
      try {
        await saveZoneWithSubZones(editingZone?.id ?? null, {
          name: name.trim(),
          description: description.trim(),
          subZones,
        });
        toast.success(editingZone ? "Đã cập nhật khu vực" : "Đã tạo khu vực mới");
        setDialogOpen(false);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error).message || "Có lỗi xảy ra khi lưu khu vực");
      }
    });
  }

  function handleDelete() {
    if (!deleteConfirmZone) return;
    startTransition(async () => {
      try {
        await deleteZone(deleteConfirmZone.id);
        toast.success(`Đã xoá khu vực "${deleteConfirmZone.name}"`);
        setDeleteConfirmZone(null);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error).message || "Có lỗi xảy ra khi xoá khu vực");
      }
    });
  }

  // Filter client-side
  const filteredZones = zones.filter((z) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const matchName = z.name.toLowerCase().includes(q);
    const matchDesc = z.description?.toLowerCase().includes(q);
    const matchSub = z.subZones.some((s) => s.name.toLowerCase().includes(q));
    return matchName || matchDesc || matchSub;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <MapPin className="size-5 text-primary" />
              Khu vực & Trại trực thuộc
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Quản lý danh mục các Khu vực và danh sách Trại / Phân xưởng trực thuộc từng khu
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="size-4" />
            Thêm khu vực
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm khu vực, trại, xưởng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Khu vực</TableHead>
                  <TableHead className="w-[200px]">Mô tả</TableHead>
                  <TableHead>Trại / Xưởng trực thuộc</TableHead>
                  <TableHead className="w-[120px] text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredZones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Không tìm thấy khu vực nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredZones.map((z) => (
                    <TableRow key={z.id}>
                      <TableCell className="font-semibold text-foreground">
                        {z.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {z.description || "—"}
                      </TableCell>
                      <TableCell>
                        {z.subZones.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {z.subZones.map((s) => (
                              <Badge
                                key={s.id}
                                variant="outline"
                                className="bg-primary/5 text-primary border-primary/20 text-xs font-normal"
                              >
                                {s.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Chưa có trại/xưởng con
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(z)}
                            className="size-8 p-0"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmZone(z)}
                            className="size-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Xoá"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination page={page} totalPages={totalPages} basePath={basePath} />
        </CardContent>
      </Card>

      {/* Dialog Thêm / Sửa Khu vực */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingZone ? `Chỉnh sửa: ${editingZone.name}` : "Thêm khu vực mới"}
            </DialogTitle>
            <DialogDescription>
              Nhập tên khu vực và danh sách các Trại hoặc Phân xưởng trực thuộc khu vực này.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tên khu */}
            <div className="space-y-1.5">
              <Label htmlFor="zone-name" className="text-sm font-medium">
                Tên khu vực <span className="text-destructive">*</span>
              </Label>
              <Input
                id="zone-name"
                placeholder="VD: Khu 1, Khu 4..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Mô tả */}
            <div className="space-y-1.5">
              <Label htmlFor="zone-desc" className="text-sm font-medium">
                Mô tả
              </Label>
              <Input
                id="zone-desc"
                placeholder="VD: Trại gà thịt A, Khu xử lý chất thải..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Trại / Phân xưởng trực thuộc */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Trại / Phân xưởng trực thuộc
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nhập tên trại/xưởng (VD: Trại 1)..."
                  value={subZoneInput}
                  onChange={(e) => setSubZoneInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSubZone();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddSubZone}
                  className="shrink-0"
                >
                  <Plus className="size-4 mr-1" />
                  Thêm
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Gõ tên và nhấn Enter hoặc bấm Thêm để thêm trại/xưởng vào khu này.
              </p>

              {/* Badges list */}
              {subZones.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 max-h-40 overflow-y-auto p-2 bg-muted/30 rounded-md border">
                  {subZones.map((sz, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium flex items-center"
                    >
                      {sz}
                      <button
                        type="button"
                        onClick={() => handleRemoveSubZone(idx)}
                        className="rounded-full hover:bg-muted-foreground/20 p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button type="button" onClick={handleSave} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin mr-2" />}
              {editingZone ? "Lưu thay đổi" : "Tạo khu vực"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận xoá */}
      <Dialog
        open={Boolean(deleteConfirmZone)}
        onOpenChange={(open) => !open && setDeleteConfirmZone(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá khu vực</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xoá khu vực{" "}
              <strong className="text-foreground">{deleteConfirmZone?.name}</strong>? Các
              trại/xưởng trực thuộc cũng sẽ bị xoá.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmZone(null)}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending && <Loader2 className="size-4 animate-spin mr-2" />}
              Xoá khu vực
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
