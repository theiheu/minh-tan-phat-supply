"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Camera, Minus, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/search-select";
import type { Zone } from "@/lib/types";
import { isPrivileged } from "@/lib/types";
import { useCartStore } from "@/stores/cart-store";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";
import { createRequisition, submitRequisition } from "../actions";
import { ZoomableImage } from "@/components/image-lightbox";
import { ProductQrScannerDialog } from "@/features/products/components/product-qr-scanner-dialog";

export function RequisitionForm({
  zones,
  defaultZoneId = null,
  currentUser = null,
  accounts = [],
  onSuccess,
  onCancel,
}: {
  zones: Zone[];
  defaultZoneId?: string | null;
  currentUser?: { id: string; role: string; name: string | null } | null;
  accounts?: { id: string; name: string | null; username: string; zone_id: string | null }[];
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const canChooseRequester = isPrivileged(currentUser?.role);

  // Thư mục khớp tên → tài khoản (dùng khi nhập tên thủ công cho người khác).
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const requesterDirectory = new Map<string, { id: string; zoneId: string | null }>();
  for (const a of accounts) {
    if (!a.name) continue;
    requesterDirectory.set(norm(a.name), { id: a.id, zoneId: a.zone_id });
  }

  // MẶC ĐỊNH: phiếu là của tài khoản đang đăng nhập. Chỉ khi "làm cho người khác"
  // mới chọn tài khoản khác từ danh sách (hiện tên đăng nhập).
  const otherAccountOptions: { value: string; label: string; hint?: string }[] = accounts
    .filter((a) => a.name)
    .map((a) => ({ value: a.id, label: a.name as string, hint: a.username }));

  const [requesterName, setRequesterName] = useState(currentUser?.name || "");
  const [requesterAccountId, setRequesterAccountId] = useState(currentUser?.id || "");
  const [choosingOther, setChoosingOther] = useState(false);
  const [typingOther, setTypingOther] = useState(false);
  const [zoneId, setZoneId] = useState(defaultZoneId ?? "");
  const [purpose, setPurpose] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function resetToSelf() {
    setRequesterAccountId(currentUser?.id || "");
    setRequesterName(currentUser?.name || "");
    setChoosingOther(false);
    setTypingOther(false);
    // Tự điền lại khu mặc định của chính mình (nếu có).
    if (defaultZoneId) setZoneId(defaultZoneId);
  }

  // Chọn 1 tài khoản người yêu cầu khác → tự điền khu mặc định của họ (nếu có).
  function onPickAccount(id: string) {
    const acc = accounts.find((a) => a.id === id);
    setRequesterAccountId(id);
    setRequesterName(acc?.name || "");
    setTypingOther(false);
    if (acc?.zone_id) setZoneId(acc.zone_id);
  }

  // Nhập tên thủ công (người không có trong danh sách) → khi gửi khớp theo tên.
  function onRequesterTyped(name: string) {
    setRequesterName(name);
    if (requesterAccountId) setRequesterAccountId("");
    const entry = requesterDirectory.get(norm(name));
    if (entry?.zoneId) setZoneId(entry.zoneId);
  }

  function resolveRequesterId(): string | null {
    if (requesterAccountId) return requesterAccountId;
    return requesterDirectory.get(norm(requesterName))?.id ?? null;
  }

  async function run(submitAfterCreate: boolean) {
    if (items.length === 0) return toast.error("Chưa có vật tư trong yêu cầu");
    let requesterId: string | undefined;
    if (canChooseRequester) {
      if (!requesterName.trim()) return toast.error("Nhập tên người yêu cầu");
      const resolved = resolveRequesterId();
      if (!resolved) {
        return toast.error(`Không tìm thấy người dùng "${requesterName.trim()}". Hãy mời user qua Quản trị → Người dùng, hoặc nhập đúng tên đã có tài khoản.`);
      }
      requesterId = resolved;
    }
    if (!zoneId) return toast.error("Chọn khu vực");
    if (!purpose.trim()) return toast.error("Nhập mục đích");

    const enqueueOffline = (submit: boolean) => {
      useOfflineQueueStore.getState().enqueue({
        zoneId,
        purpose: purpose.trim(),
        requesterId,
        submitAfterCreate: submit,
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          name: i.name,
          label: i.label,
          unit: i.unit,
        })),
      });
      clear();
      toast.info("Đang ngoại tuyến. Phiếu yêu cầu đã được lưu trên máy và sẽ tự động gửi khi có mạng.");
      router.push("/requisitions");
      router.refresh();
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOffline(submitAfterCreate);
      return;
    }

    startTransition(async () => {
      try {
        const id = await createRequisition({
          zoneId,
          purpose: purpose.trim(),
          requesterId,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        });
        if (submitAfterCreate) await submitRequisition(id);
        clear();
        toast.success(submitAfterCreate ? "Đã gửi phiếu yêu cầu" : "Đã lưu nháp");
        if (onSuccess) {
          onSuccess(id);
        } else {
          router.push(`/requisitions/${id}`);
        }
        router.refresh();
      } catch (err) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          enqueueOffline(submitAfterCreate);
          return;
        }

        const msg = err instanceof Error ? err.message : "Tạo phiếu thất bại";
        const lower = msg.toLowerCase();
        if (
          lower.includes("fetch") ||
          lower.includes("network") ||
          lower.includes("timeout") ||
          lower.includes("aborted") ||
          lower.includes("connection") ||
          lower.includes("offline") ||
          lower.includes("failed to fetch") ||
          lower.includes("load failed")
        ) {
          enqueueOffline(submitAfterCreate);
          return;
        }

        if (msg.includes("giỏ hàng") || msg.includes("variant_id")) {
          toast.error(msg, {
            action: {
              label: "Xóa giỏ hàng",
              onClick: () => clear(),
            },
            duration: 8000,
          });
        } else {
          toast.error(msg);
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-semibold">Thông tin phiếu</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {canChooseRequester && (
            <div className="space-y-2 sm:col-span-2">
              <div className="space-y-1.5">
                <Label className="font-medium">Người yêu cầu</Label>
                {!choosingOther ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-border/80 bg-muted/20 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{requesterName || currentUser?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">Tài khoản của bạn (mặc định)</div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setChoosingOther(true)}>
                      Làm phiếu cho người khác
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <SearchSelect
                      value={requesterAccountId}
                      onChange={onPickAccount}
                      options={otherAccountOptions}
                      placeholder="Chọn tên tài khoản người khác…"
                      searchPlaceholder="Gõ tên hoặc tên đăng nhập để tìm…"
                      emptyText="Không tìm thấy tài khoản."
                    />
                    {!typingOther ? (
                      <button
                        type="button"
                        onClick={() => setTypingOther(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        hoặc nhập tên không có trong danh sách →
                      </button>
                    ) : (
                      <Input
                        value={requesterName}
                        onChange={(e) => onRequesterTyped(e.target.value)}
                        list="mtp-requester-names"
                        placeholder="Nhập tên người yêu cầu…"
                      />
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={resetToSelf}>
                      ← Quay lại tài khoản của tôi
                    </Button>
                  </div>
                )}
                <datalist id="mtp-requester-names">
                  {accounts.map((a) => (a.name ? <option key={a.id} value={a.name} /> : null))}
                </datalist>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="font-medium">Khu vực</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn khu vực" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="font-medium">Mục đích</Label>
            <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Mục đích sử dụng vật tư…" rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-border shadow-xs rounded-xl">
        <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">Vật tư yêu cầu</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScannerOpen(true)}
            className="h-8 gap-1.5 text-xs shrink-0"
          >
            <Camera className="size-3.5 text-primary" />
            <span>Quét QR</span>
          </Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có vật tư. Hãy thêm từ Kho vật tư.</p>
          ) : (
            <div className="space-y-3">
              {items.some((i) => i.stock === 0) && (
                <div className="rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                  ⚠️ <strong>Lưu ý:</strong> Phiếu chứa vật tư đang hết hàng trong kho. Quản kho sẽ tiếp nhận thông tin yêu cầu để đặt hàng từ nhà cung cấp và tự động cấp phát khi hàng về.
                </div>
              )}
              <ul className="divide-y">
                {items.map((i) => (
                  <li key={i.variantId} className="flex items-start gap-3 py-3">
                    {i.image ? (
                      <ZoomableImage
                        src={i.image}
                        alt={i.name}
                        title={`${i.name} · ${i.label}`}
                        className="size-14 sm:size-16 shrink-0 rounded-lg border object-cover aspect-square"
                      />
                    ) : (
                      <div className="flex size-14 sm:size-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                        <Package className="size-6 opacity-40" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-snug line-clamp-2">{i.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        {i.label && i.label !== i.unit && <span className="truncate">{i.label}</span>}
                        {i.unit && (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground text-[10px]">
                            ĐVT: {i.unit}
                          </span>
                        )}
                        {i.stock === 0 && (
                          <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            Chờ nhập hàng
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between gap-2 shrink-0 self-stretch">
                      {/* Thùng rác ở trên */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive p-0"
                        onClick={() => removeItem(i.variantId)}
                        aria-label="Xóa"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>

                      {/* Số lượng ở dưới */}
                      <div className="inline-flex h-6 items-center rounded-md border border-border/80 bg-background p-0.5 shadow-xs">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="h-5 w-5 rounded text-foreground hover:bg-muted p-0"
                          onClick={() => updateQty(i.variantId, Math.max(1, i.quantity - 1))}
                          aria-label="Giảm"
                        >
                          <Minus className="size-2.5" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          className="h-5 w-7 border-0 bg-transparent text-center text-xs font-bold tabular-nums p-0 focus-visible:ring-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={i.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val > 0) {
                              updateQty(i.variantId, val);
                            }
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (isNaN(val) || val < 1) {
                              updateQty(i.variantId, 1);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="h-5 w-5 rounded text-foreground hover:bg-muted p-0"
                          onClick={() => updateQty(i.variantId, i.quantity + 1)}
                          aria-label="Tăng"
                        >
                          <Plus className="size-2.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Hủy
          </Button>
        )}
        <Button variant="outline" onClick={() => run(false)} disabled={pending}>
          Lưu nháp
        </Button>
        <Button onClick={() => run(true)} disabled={pending}>
          {pending ? "Đang xử lý…" : "Gửi yêu cầu"}
        </Button>
      </div>

      <ProductQrScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} />
    </div>
  );
}
