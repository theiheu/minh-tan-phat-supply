"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { createRequisition, submitRequisition } from "../actions";
import { appAssetUrl } from "@/lib/images";

export function RequisitionForm({
  zones,
  defaultZoneId = null,
  currentUser = null,
  accounts = [],
}: {
  zones: Zone[];
  defaultZoneId?: string | null;
  currentUser?: { id: string; role: string; name: string | null } | null;
  accounts?: { id: string; name: string | null; username: string; zone_id: string | null }[];
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
        router.push(`/requisitions/${id}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo phiếu thất bại");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin phiếu</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {canChooseRequester && (
            <div className="space-y-2 sm:col-span-2">
              <div className="space-y-1.5">
                <Label>Người yêu cầu</Label>
                {!choosingOther ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
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
            <Label>Khu vực</Label>
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
            <Label>Mục đích</Label>
            <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Mục đích sử dụng vật tư…" rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vật tư yêu cầu</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có vật tư. Hãy thêm từ Kho vật tư.</p>
          ) : (
            <ul className="divide-y">
              {items.map((i) => (
                <li key={i.variantId} className="flex items-center gap-3 py-2.5">
                  {i.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={appAssetUrl(i.image)} alt="" className="size-11 shrink-0 rounded-md border object-cover" />
                  ) : (
                    <div className="size-11 shrink-0 rounded-md border bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{i.label}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon-xs" onClick={() => updateQty(i.variantId, i.quantity - 1)} aria-label="Giảm">−</Button>
                    <span className="w-10 text-center text-sm tabular-nums">{i.quantity}</span>
                    <Button variant="outline" size="icon-xs" onClick={() => updateQty(i.variantId, i.quantity + 1)} aria-label="Tăng">+</Button>
                  </div>
                  <Button variant="ghost" size="icon-xs" onClick={() => removeItem(i.variantId)} aria-label="Xóa">×</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => run(false)} disabled={pending}>
          Lưu nháp
        </Button>
        <Button onClick={() => run(true)} disabled={pending}>
          {pending ? "Đang xử lý…" : "Gửi yêu cầu"}
        </Button>
      </div>
    </div>
  );
}
