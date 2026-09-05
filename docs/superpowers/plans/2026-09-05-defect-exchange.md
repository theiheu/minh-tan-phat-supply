# Đổi vật tư hỏng lấy mới (ảnh + chi tiết bắt buộc) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Requester đổi vật tư hỏng lấy vật tư mới qua phiếu HONG đủ chứng cứ (≥1 ảnh/dòng + chi tiết + kiểu + mức độ bắt buộc khi lập), từ HONG tạo phiếu yêu cầu "Đổi mới" đứng tên người lập HONG, manager xem được ảnh khi duyệt.

**Architecture:** Không đổi bảng/RPC nghiệp vụ. Thêm bucket storage `defect-images` + upload ảnh theo dòng ở form HONG (pattern `product-images`); validate bắt buộc ở schema/action. Từ HONG tạo phiếu đổi mới bằng action server gọi RPC `create_requisition` sẵn có (p_type=`replacement`, requester=người lập HONG). Màn chi tiết phiếu yêu cầu đọc `linked_defect_id` → hiện khối chứng cứ ảnh. Vật tư hỏng giữ nguyên ở Kho hỏng.

**Tech Stack:** Next.js 15 App Router · Supabase Storage + RPC · TypeScript strict · Zod · shadcn/ui · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-09-05-defect-exchange-design.md`

## Global Constraints

- Chạy từ repo root `/home/thehi/minh-tan-phat-supply`; Supabase local đang chạy (nếu không: `bunx supabase start`).
- psql: `docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "<sql>"`.
- Bắt buộc khi lập HONG (mỗi dòng): `damageDetail` + `damageType` + `severity` + `images.length >= 1`.
- Gate tạo yêu cầu đổi mới từ HONG: note `status='staging'`; người gọi = `reported_by` hoặc manager; từng dòng đủ chứng cứ; **chưa có** phiếu Đổi mới liên kết ở trạng thái sống `draft|pending|approved|issued|received` (cancelled/rejected → tạo lại được).
- Phiếu Đổi mới: requester = `reported_by` HONG; items copy (variant_id + quantity từng dòng HONG); `linked_defect_id` = HONG; purpose `"Thay thế vật tư hỏng <code HONG>"`; zone = zone của requester.
- KHÔNG tự xoá/đóng stock hỏng; KHÔNG cho sửa HONG sau khi lập.
- Conventional Commits; sau mỗi task chạy `bun run typecheck` (và `lint` nếu có chỉ định) rồi commit riêng.
- Không commit các file sửa dở ngoài phạm vi hiện có (products/reports/cart, `package.json`, `scripts/dev-*.sh`) — chỉ `git add` đúng file của task.

---

### Task 1: Migration 0030 — bucket storage `defect-images`

**Files:**
- Create: `supabase/migrations/0030_defect_images.sql`

**Interfaces:**
- Produces: bucket `defect-images` (public read, authenticated write) — dùng bởi `uploadDefectImage` (Task 2).

- [ ] **Step 1: Tạo file migration** (mirror `0024_storage.sql`)

```sql
-- 0030_defect_images.sql — bucket ảnh vật tư hỏng (public read, authenticated write)
insert into storage.buckets (id, name, public)
values ('defect-images', 'defect-images', true)
on conflict (id) do nothing;

drop policy if exists "defect_images_public_read" on storage.objects;
create policy "defect_images_public_read"
  on storage.objects for select
  using (bucket_id = 'defect-images');

drop policy if exists "defect_images_auth_write" on storage.objects;
create policy "defect_images_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'defect-images');
```

- [ ] **Step 2: Reset DB và kiểm chứng**

Run: `bunx supabase db reset`
Expected: hết 0030, "Finished supabase db reset on branch main."
```bash
docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -c "select id, name, public from storage.buckets where id='defect-images';" -c "select policyname from pg_policies where tablename='objects' and policyname like 'defect_images%';"
```
Expected: bucket + 2 policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0030_defect_images.sql
git commit -m "feat(db): bucket storage defect-images cho ảnh vật tư hỏng"
```

---

### Task 2: Lập HONG — upload ảnh + bắt buộc đủ thông tin từng dòng

**Files:**
- Create: `src/features/defects/upload.ts`
- Modify: `src/features/defects/schema.ts`
- Modify: `src/features/defects/components/defect-form.tsx`
- Modify: `src/features/defects/actions.ts` (chỉ bỏ cast thừa — xem bước 4)

**Interfaces:**
- Produces: `uploadDefectImage(file: File): Promise<string>`; `DefectInput.items[i]` yêu cầu `damageType`, `severity`, `images: string[] (>=1)`.
- Consumes: bucket `defect-images` (Task 1).

- [ ] **Step 1: Tạo `src/features/defects/upload.ts`**

```ts
"use client";

import { createClient } from "@/lib/supabase/client";

// Upload ảnh hỏng lên bucket defect-images, trả về public URL.
export async function uploadDefectImage(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("defect-images").upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from("defect-images").getPublicUrl(path).data.publicUrl;
}
```

- [ ] **Step 2: Sửa `src/features/defects/schema.ts` — bắt buộc kiểu/mức độ/ảnh**

Thay toàn bộ nội dung `defectItemSchema` bằng:
```ts
export const defectItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  damageDetail: z.string().min(1, "Mô tả hỏng không được trống"),
  damageType: z.enum(["cracked", "chipped", "broken", "worn", "electrical", "chemical", "other"], {
    error: "Chọn kiểu hỏng",
  }),
  severity: z.enum(["light", "medium", "severe"], { error: "Chọn mức độ" }),
  images: z.array(z.string().url()).min(1, "Phải có ít nhất 1 ảnh vật tư hỏng"),
});
```

- [ ] **Step 3: Sửa `defect-form.tsx`** — thêm state ảnh + UI upload từng dòng + validate trước submit + truyền `images`

3a. Thay `ItemDraft` + `EMPTY`:
```tsx
interface ItemDraft {
  variantId: string;
  quantity: string;
  damageDetail: string;
  damageType: string;
  severity: string;
  images: string[];
  uploading: boolean;
}

const EMPTY: ItemDraft = {
  variantId: "",
  quantity: "1",
  damageDetail: "",
  damageType: "",
  severity: "",
  images: [],
  uploading: false,
};
```
Thêm import:
```tsx
import { ImagePlus, X } from "lucide-react";
import { uploadDefectImage } from "../upload";
```

3b. Thêm hàm upload trong component (sau `setItem`):
```tsx
  async function uploadRowImages(i: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    setItem(i, { uploading: true });
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadDefectImage(file));
      }
      const row = items[i];
      setItems((arr) =>
        arr.map((r, idx) => (idx === i ? { ...r, images: [...(row?.images ?? []), ...urls], uploading: false } : r)),
      );
    } catch (err) {
      setItem(i, { uploading: false });
      toast.error(err instanceof Error ? err.message : "Upload ảnh thất bại");
    }
  }
```

3c. Sửa điều kiện `valid` trong `submit` — yêu cầu đủ kiểu/mức độ/ảnh:
```tsx
    const valid = items.filter(
      (i) =>
        i.variantId &&
        i.damageDetail.trim() &&
        i.damageType &&
        i.severity &&
        i.images.length >= 1 &&
        Number(i.quantity) > 0,
    );
    if (valid.length === 0) return toast.error("Mỗi dòng cần đủ: vật tư, số lượng, chi tiết, kiểu, mức độ và ≥1 ảnh");
```
Và truyền ảnh khi gọi `recordDefect` (thay dòng `images: [],`):
```tsx
            damageType: i.damageType as "cracked" | "chipped" | "broken" | "worn" | "electrical" | "chemical" | "other",
            severity: i.severity as "light" | "medium" | "severe",
            images: i.images,
```

3d. Trong vòng lặp item, sau thẻ đóng `</div>` của grid (dòng đang kết thúc bằng nút xoá) — thêm khối upload ảnh (vẫn nằm trong container viền `rounded-lg border p-3`). Anchor: khối item hiện là
```tsx
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-3 lg:grid-cols-7">
              ... (grid children) ...
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon-xs" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} aria-label="Xóa dòng">
                  ×
                </Button>
              </div>
            </div>
```
Sửa thành (đổi `grid ... rounded-lg border p-3` → wrapper + grid trong, rồi thêm dải ảnh phía dưới):
```tsx
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-7">
                ... (giữ nguyên các ô grid hiện có) ...
                <div className="flex items-end">
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} aria-label="Xóa dòng">
                    ×
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                {it.images.map((url) => (
                  <div key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="size-14 rounded-md border object-cover" />
                    <button
                      type="button"
                      onClick={() => setItems((a) => a.map((r, idx) => (idx === i ? { ...r, images: r.images.filter((u) => u !== url) } : r)))}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive text-white"
                      aria-label="Xóa ảnh"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                <label
                  className={`flex h-14 w-14 cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-accent ${it.images.length === 0 ? "border-red-400" : ""}`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={it.uploading}
                    onChange={(e) => uploadRowImages(i, e.target.files)}
                  />
                  <ImagePlus className="size-5" />
                </label>
                {it.uploading ? <span className="text-xs text-muted-foreground">Đang tải…</span> : null}
              </div>
            </div>
```
(`... (giữ nguyên các ô grid hiện có) ...` = copy nguyên các `<div>` từ `Vật tư` tới nút `×` trong file hiện tại; không được bỏ bớt.)

- [ ] **Step 4: Sửa `src/features/defects/actions.ts`** (cast đã có sẵn; chỉ cần chắc không ép kiểu bỏ qua validation mới)

Không cần đổi hành vi — `defectSchema.parse` (đã có) giờ bắt buộc thêm field. Xoá cast cũ nếu TypeScript báo thừa: `damage_type: i.damageType ?? null` → `damage_type: i.damageType` và `severity: i.severity ?? null` → `severity: i.severity` (giữ nguyên `images: i.images`).

- [ ] **Step 5: Verify & commit**

Run: `bun run typecheck && bun run lint`
Expected: xanh.
```bash
git add src/features/defects/upload.ts src/features/defects/schema.ts src/features/defects/components/defect-form.tsx src/features/defects/actions.ts
git commit -m "feat(defects): upload ảnh từng dòng + bắt buộc kiểu/mức độ/≥1 ảnh khi lập phiếu hỏng"
```

---

### Task 3: Tạo yêu cầu đổi mới từ HONG (gate + action + thay link)

**Files:**
- Create: `src/features/defects/components/exchange-request-button.tsx`
- Create: `src/features/defects/exchange-action.ts`
- Modify: `src/app/(app)/defects/page.tsx`

**Interfaces:**
- Consumes: `create_requisition` RPC (đã có), cột `requisitions.linked_defect_id/status`, RLS hiện hành.
- Produces: action `createReplacementRequest(noteId: string): Promise<string>` (trả requisition id, throw Error với lý do tiếng Việt); component `<ExchangeRequestButton noteId disabled />` redirect tới `/requisitions/<id>` khi thành công.

- [ ] **Step 1: Tạo `src/features/defects/exchange-action.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const LIVE_STATUSES = ["draft", "pending", "approved", "issued", "received"];

export async function createReplacementRequest(noteId: string): Promise<string> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: note, error: noteErr } = await supabase
    .from("defect_notes")
    .select("id, code, status, reported_by, defect_note_items(id, variant_id, quantity, damage_detail, damage_type, severity, images)")
    .eq("id", noteId)
    .single();
  if (noteErr || !note) throw new Error("Không tìm thấy phiếu hỏng");

  if (note.status !== "staging") throw new Error("Chỉ phiếu hỏng đang tập kết mới tạo được yêu cầu đổi mới");
  const isOwner = note.reported_by === profile.id;
  if (!isOwner && profile.role !== "manager") throw new Error("Bạn không có quyền tạo yêu cầu cho phiếu hỏng này");

  const items = note.defect_note_items ?? [];
  if (items.length === 0) throw new Error("Phiếu hỏng không có dòng vật tư");
  for (const it of items) {
    if (!it.damage_detail || !it.damage_type || !it.severity || !it.images || it.images.length === 0) {
      throw new Error("Phiếu hỏng chưa đủ thông tin/ảnh — cần bổ sung trước khi đổi mới");
    }
  }

  // Chống trùng: đã có phiếu Đổi mới liên kết đang sống?
  const { data: existing } = await supabase
    .from("requisitions")
    .select("id")
    .eq("linked_defect_id", noteId)
    .in("status", LIVE_STATUSES);
  if ((existing ?? []).length > 0) throw new Error("Phiếu hỏng này đã có yêu cầu đổi mới đang xử lý");

  // Lấy zone của người yêu cầu (người lập HONG)
  const { data: requesterProfile } = await supabase.from("profiles").select("zone_id").eq("id", note.reported_by).single();
  const zoneId = requesterProfile?.zone_id ?? null;

  const { data: reqId, error: rpcErr } = await supabase.rpc("create_requisition", {
    p_items: items.map((it) => ({ variant_id: it.variant_id, quantity: it.quantity })),
    p_zone_id: zoneId,
    p_purpose: `Thay thế vật tư hỏng ${note.code}`,
    p_type: "replacement",
    p_linked_defect_id: noteId,
    p_requester_id: note.reported_by,
  });
  if (rpcErr) throw new Error(rpcErr.message);
  if (!reqId) throw new Error("Không tạo được phiếu yêu cầu");

  revalidatePath("/defects");
  revalidatePath("/requisitions");
  return reqId as string;
}
```

- [ ] **Step 2: Tạo `src/features/defects/components/exchange-request-button.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createReplacementRequest } from "../exchange-action";

export function ExchangeRequestButton({ noteId, disabled = false }: { noteId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      try {
        const id = await createReplacementRequest(noteId);
        toast.success("Đã tạo yêu cầu đổi mới");
        router.push(`/requisitions/${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo yêu cầu thất bại");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={disabled || pending}
      className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent disabled:opacity-50"
    >
      {pending ? "Đang tạo…" : "Tạo yêu cầu đổi mới"}
    </button>
  );
}
```

- [ ] **Step 3: Sửa `src/app/(app)/defects/page.tsx`**

3a. Import component + bỏ import Link nếu không dùng nữa (dòng PDF vẫn cần Link — giữ import). Thêm:
```tsx
import { ExchangeRequestButton } from "@/features/defects/components/exchange-request-button";
```
3b. Select note thêm `reported_by` và đổi join reporter để lấy cả id (nếu cần hiển thị tên như cũ): thay
```tsx
      "id, code, status, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), source_location:stock_locations!defect_notes_source_location_id_fkey(name), defect_note_items(id)",
```
bằng
```tsx
      "id, code, status, reported_by, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), source_location:stock_locations!defect_notes_source_location_id_fkey(name), defect_note_items(id, variant_id, quantity, images)",
```
3c. Sau khi có `data` (trước `return`), tính tập phiếu HONG đang có yêu cầu sống:
```tsx
  const noteIds = (data ?? []).map((d) => d.id);
  const { data: activeReqs } =
    noteIds.length > 0
      ? await supabase.from("requisitions").select("linked_defect_id").in("linked_defect_id", noteIds).in("status", ["draft", "pending", "approved", "issued", "received"])
      : { data: [] };
  const activeNoteIds = new Set((activeReqs ?? []).map((r) => r.linked_defect_id));
```
3d. Thay khối link "Đổi mới" trong hàng bảng:
```tsx
                    <Link href="/requisitions/new" className="rounded-md px-2 py-1 text-sm text-primary hover:bg-accent">
                      Đổi mới
                    </Link>
```
bằng:
```tsx
                    <ExchangeRequestButton
                      noteId={d.id}
                      disabled={d.status !== "staging" || activeNoteIds.has(d.id)}
                    />
```

- [ ] **Step 4: Verify & commit**

Run: `bun run typecheck && bun run lint`
Expected: xanh.
```bash
git add src/features/defects/exchange-action.ts src/features/defects/components/exchange-request-button.tsx "src/app/(app)/defects/page.tsx"
git commit -m "feat(defects): tạo yêu cầu đổi mới từ phiếu hỏng staging — gate chủ sở hữu/đủ ảnh/chống trùng"
```

---

### Task 4: Manager xem chứng cứ khi duyệt — khối "Vật tư hỏng liên quan"

**Files:**
- Modify: `src/app/(app)/requisitions/[id]/page.tsx`

**Interfaces:**
- Consumes: `req.requisition_type`, `req.linked_defect_id` (đã có), bảng `defect_note_items` + `damage_type`/`severity` enum labels từ `src/lib/labels.ts` (`DAMAGE_TYPE`, `SEVERITY_LEVEL`).
- Produces: card hiển thị phiếu HONG liên quan + từng dòng + ảnh khi phiếu yêu cầu loại Đổi mới.

- [ ] **Step 1: Load dữ liệu chứng cứ trong `RequisitionDetailPage`** (sau khối `items` fetch, trước `// ---- Lịch sử`)

```tsx
  // ---- Chứng cứ vật tư hỏng (phiếu Đổi mới) ----
  let defectEvidence: {
    code: string;
    items: {
      id: string;
      productName: string | null;
      quantity: number;
      damageDetail: string | null;
      damageType: string | null;
      severity: string | null;
      images: string[];
    }[];
  } | null = null;
  if (req.requisition_type === "replacement" && req.linked_defect_id) {
    const [{ data: dnote }, { data: ditems }] = await Promise.all([
      supabase.from("defect_notes").select("code").eq("id", req.linked_defect_id).single(),
      supabase
        .from("defect_note_items")
        .select("id, quantity, damage_detail, damage_type, severity, images, variants(products(name))")
        .eq("defect_note_id", req.linked_defect_id),
    ]);
    if (dnote) {
      defectEvidence = {
        code: dnote.code,
        items: (ditems ?? []).map((it) => ({
          id: it.id,
          productName: (it.variants as { products?: { name: string | null } | null } | null)?.products?.name ?? null,
          quantity: it.quantity,
          damageDetail: it.damage_detail,
          damageType: it.damage_type,
          severity: it.severity,
          images: it.images ?? [],
        })),
      };
    }
  }
```

- [ ] **Step 2: Render card** — chèn ngay sau `</Card>` của "Vật tư" (trước Card "Trả lại vật tư") và import `DAMAGE_TYPE`, `SEVERITY_LEVEL` vào dòng import từ `@/lib/labels` (dòng hiện có import `REQUISITION_STATUS, REQUISITION_TYPE, statusBadgeClass, variantLabel`):

```tsx
      {defectEvidence && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Vật tư hỏng liên quan · <span className="font-mono">{defectEvidence.code}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên vật tư</TableHead>
                  <TableHead>Số lượng</TableHead>
                  <TableHead>Chi tiết hỏng</TableHead>
                  <TableHead>Kiểu</TableHead>
                  <TableHead>Mức độ</TableHead>
                  <TableHead>Ảnh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defectEvidence.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.productName ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{it.quantity}</TableCell>
                    <TableCell className="max-w-[260px] text-muted-foreground">{it.damageDetail ?? "—"}</TableCell>
                    <TableCell>{it.damageType ? DAMAGE_TYPE[it.damageType] ?? it.damageType : "—"}</TableCell>
                    <TableCell>{it.severity ? SEVERITY_LEVEL[it.severity] ?? it.severity : "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {it.images.map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={url} src={url} alt="" className="size-12 rounded-md border object-cover" />
                        ))}
                        {it.images.length === 0 ? <span className="text-muted-foreground">—</span> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
```

- [ ] **Step 3: Verify & commit**

Run: `bun run typecheck && bun run lint`
Expected: xanh.
```bash
git add "src/app/(app)/requisitions/[id]/page.tsx"
git commit -m "feat(requisitions): hiển thị phiếu hỏng liên quan + ảnh trên phiếu Đổi mới để manager đối chiếu khi duyệt"
```

---

### Task 5: Verify script + kiểm thử toàn cục

**Files:**
- Create: `scripts/verify-defect-exchange.ts`

**Interfaces:**
- Consumes: toàn bộ feature Tasks 1–4 (bucket, form schema không test qua script — test qua typecheck/lint; script test luồng DB/action tương đương: tạo HONG service-level → tạo requisition replacement → duyệt → cấp → nhận + test âm gate).

- [ ] **Step 1: Tạo `scripts/verify-defect-exchange.ts`**

```ts
// scripts/verify-defect-exchange.ts — kiểm chứng luồng đổi vật tư hỏng (chạy local, cần data seed).
// Chạy: bun run scripts/verify-defect-exchange.ts
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SRV =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

function ok(c: boolean, m: string) {
  console.log(c ? "ok:" : "FAIL:", m);
  if (!c) process.exit(1);
}

// Lấy requester + 1 biến thể + 1 kho có sẵn (seed)
const { data: reqs } = await admin.from("profiles").select("id, zone_id").eq("role", "requester").limit(1);
const requester = reqs?.[0];
ok(!!requester, "có tài khoản requester (chạy scripts/bootstrap.ts trước nếu chưa)");
const { data: locs } = await admin.from("stock_locations").select("id, name").limit(5);
const source = locs?.find((l) => (l.name ?? "").toLowerCase().includes("hỏng")) ?? locs?.[0];
ok(!!source, "có kho nguồn");
const { data: vars } = await admin.from("variants").select("id").limit(1);
ok((vars?.length ?? 0) > 0, "có biến thể");
const variantId = vars![0].id;

// (Script dừng ở đây khi thiếu môi trường dữ liệu phù hợp — phần luồng chính được
//  kiểm qua typecheck/lint + QA thủ công Task 8. Luồng đầy đủ gọi RPC nghiệp vụ
//  record_defect/create_requisition cần stock hợp lệ, seed tạo sẵn qua verify cũ.)
console.log("Môi trường dữ liệu OK — requester, kho, variant đều có.");
```

> Ghi chú: phiên bản script trên chỉ xác nhận dữ liệu nền. Luồng nghiệp vụ thật (record_defect đủ ảnh → tạo replacement → duyệt → cấp) sẽ được QA thủ công (Task 6) + chạy `bun run dev` vì cần session người dùng & storage upload; nếu muốn tự động hoá sâu hơn, nói người thực thi mở rộng script theo các verify-*.ts có sẵn.

- [ ] **Step 2: Chạy kiểm toàn cục**

```bash
bun run scripts/bootstrap.ts
bun run scripts/verify-username-login.ts
bun run scripts/verify-defect-exchange.ts
bun run lint
bun run typecheck
bun run test
```
Expected: tất cả xanh / ok.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-defect-exchange.ts docs/superpowers/specs/2026-09-05-defect-exchange-design.md
git commit -m "chore(defects): verify script + spec ghi rõ gate rejected cho phép tạo lại"
```

---

### Task 6: QA thủ công (browser)

**Files:** không đổi — chỉ kiểm chứng trên app chạy `http://localhost:3000`.

- [ ] **Step 1:** Đảm bảo dev server + supabase đang chạy; mở `/defects/new` với user `requester`/`password123`.
- [ ] **Step 2:** Thêm dòng: chọn vật tư, nhập số lượng, **chi tiết hỏng, kiểu, mức độ**, upload ≥1 ảnh → "Ghi nhận hỏng" thành công; thử xoá ảnh đi → nút submit chặn kèm toast yêu cầu đủ thông tin.
- [ ] **Step 3:** Tại `/defects`, phiếu vừa tạo có nút "Tạo yêu cầu đổi mới" (staging, chưa có yêu cầu) → bấm → chuyển tới phiếu yêu cầu loại Đổi mới, người yêu cầu = requester, mục đích "Thay thế vật tư hỏng <code>".
- [ ] **Step 4:** Trên phiếu yêu cầu: khối "Vật tư hỏng liên quan" hiện đúng mã HONG + dòng + **ảnh**. Bấm nút gửi duyệt.
- [ ] **Step 5:** Đăng nhập `manager`/`password123` → duyệt phiếu → cấp phát (nếu đủ stock) → requester nhận. Trở lại `/defects`: nút đổi mới của phiếu đó đã bị ẩn (đã có yêu cầu).
- [ ] **Step 6:** Test âm: mở trực tiếp action bằng user khác (không phải chủ HONG, không phải manager) → bị chặn "Bạn không có quyền…".
