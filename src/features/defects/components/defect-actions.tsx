"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelDefect } from "../actions";
import { sendToRepair } from "@/features/repairs/actions";

export function DefectActions({ note }: { note: { id: string; status: string; itemIds: string[] } }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [vendor, setVendor] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thao tác thất bại");
      }
    });
  }

  if (note.status !== "staging") return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" onClick={() => setOpen(true)} disabled={note.itemIds.length === 0}>
        Đưa đi sửa
      </Button>
      <Button size="sm" variant="destructive" onClick={() => run(() => cancelDefect(note.id), "Đã hủy")} disabled={pending}>
        Hủy
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đưa đi sửa chữa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Đơn vị sửa chữa</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Công ty sửa chữa…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ngày gửi</Label>
                <Input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Dự kiến về</Label>
                <Input type="date" value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={pending || !vendor.trim()}
              onClick={() =>
                run(
                  () =>
                    sendToRepair({
                      defectItemIds: note.itemIds,
                      vendor: vendor.trim(),
                      sentAt: sentAt || null,
                      expectedReturnAt: expectedReturnAt || null,
                    }),
                  "Đã tạo phiếu sửa",
                )
              }
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
