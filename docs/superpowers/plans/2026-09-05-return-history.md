# Lịch sử trả lại vật tư trong phiếu yêu cầu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ghi lại lịch sử trả lại vật tư của phiếu yêu cầu thành các sự kiện có cấu trúc (`requisition_returns` + `requisition_return_items`), hiển thị card "Lịch sử trả lại" cho cả người yêu cầu lẫn manager, và cho form trả biết số đã trả để giới hạn nhập đúng (`đã cấp − đã trả`).

**Architecture:** Thêm 2 bảng lịch sử (`requisition_returns` header 1-lần-trả + `requisition_return_items` từng dòng) với RLS select manager-or-owner (copy mẫu `requisition_items_select`). RPC `return_requisition_items` hiện có (security definer) được mở rộng: trong cùng transaction với `_move_stock`, insert header + dòng lịch sử. Trang chi tiết phiếu truy vấn lịch sử kèm profiles/variants/products → render card; tính `returnedByVariant` để cấp vào form trả và danh sách vật tư.

**Tech Stack:** Next.js 15 App Router · Supabase (migrations SQL + RPC security definer + RLS) · TypeScript strict · shadcn/ui · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-09-05-return-history-design.md`

## Global Constraints

- Chạy từ repo root `/home/thehi/minh-tan-phat-supply`; Supabase local đang chạy (kiểm tra: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:54321/rest/v1/` phải trả `200`).
- psql: `docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "<sql>"`.
- Áp migration local: `bunx supabase db reset` — **sẽ xoá dữ liệu động local**; sau đó luôn chạy `bun run scripts/bootstrap.ts` (tạo tài khoản `manager`/`requester`, mật khẩu `password123`). KHÔNG áp migration mới lên production bằng tay — đẩy lên git để CI/deploy chạy.
- RLS: chỉ thêm policy `for select` (manager hoặc owner); mọi ghi qua RPC security definer. Không thêm policy insert để chặn user tự chèn lịch sử giả.
- Không thêm ô lý do/ghi chú khi trả; không đổi trạng thái phiếu khi trả; không backfill lịch sử cũ.
- Conventional Commits; sau mỗi task chạy `bun run typecheck` (và `bun run lint` khi chạm file TSX) rồi commit riêng.
- Chỉ `git add` đúng file của task (không kéo theo các file sửa dở ngoài phạm vi hiện có).

---

### Task 1: Migration 0032 — bảng lịch sử + RLS + RPC ghi lịch sử

**Files:**
- Create: `supabase/migrations/0032_requisition_returns.sql`

**Interfaces:**
- Produces: bảng `public.requisition_returns` / `public.requisition_return_items` + policy select manager-or-owner; RPC `return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid) returns void` (giữ signature, giờ còn insert header + dòng lịch sử). Dùng bởi Task 3 (query/UI) và Task 4 (verify).

- [ ] **Step 1: Tạo file migration hoàn chỉnh**

```sql
-- 0032_requisition_returns.sql — lịch sử trả lại vật tư của phiếu yêu cầu
create table public.requisition_returns (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.requisitions(id) on delete cascade,
  returned_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.requisition_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.requisition_returns(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity integer not null check (quantity > 0)
);

create index requisition_returns_requisition_id_idx on public.requisition_returns(requisition_id);
create index requisition_return_items_return_id_idx on public.requisition_return_items(return_id);

alter table public.requisition_returns enable row level security;
alter table public.requisition_return_items enable row level security;

create policy "requisition_returns_select" on public.requisition_returns for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.requisitions r where r.id = requisition_id and r.requester_id = auth.uid()
  ));

create policy "requisition_return_items_select" on public.requisition_return_items for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.requisition_returns rr
    join public.requisitions r on r.id = rr.requisition_id
    where rr.id = return_id and r.requester_id = auth.uid()
  ));

-- ===========================================================================
-- return_requisition_items: giữ nguyên gate/check, thêm ghi header + dòng lịch sử
-- ===========================================================================
create or replace function public.return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.requisition_status;
  v_requester uuid;
  v_main uuid;
  v_return_id uuid;
  it record;
  v_issued int;
  v_returned int;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status, requester_id into v_status, v_requester from public.requisitions where id = p_requisition_id for update;
  if v_requester is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ người yêu cầu hoặc quản lý kho được nhập trả lại';
  end if;
  if v_status not in ('issued','received') then raise exception 'Phiếu chưa cấp phát nên không thể trả lại (hiện tại: %)', v_status; end if;

  insert into public.requisition_returns (requisition_id, returned_by)
  values (p_requisition_id, auth.uid())
  returning id into v_return_id;

  for it in select value from jsonb_array_elements(p_items) loop
    select quantity into v_issued from public.requisition_items
    where requisition_id = p_requisition_id and variant_id = (it.value->>'variant_id')::uuid;
    if v_issued is null then raise exception 'Variant % không có trong phiếu', it.value->>'variant_id'; end if;

    select coalesce(sum(quantity),0) into v_returned from public.stock_movements
    where ref_type = 'requisition' and ref_id = p_requisition_id
      and variant_id = (it.value->>'variant_id')::uuid and movement_type = 'return_in';

    if (it.value->>'quantity')::int > v_issued - v_returned then
      raise exception 'Số lượng trả vượt quá số đã cấp cho variant %', it.value->>'variant_id';
    end if;

    perform public._move_stock(
      (it.value->>'variant_id')::uuid, null, v_main,
      (it.value->>'quantity')::int, 'return_in', 'requisition', p_requisition_id, p_by);

    insert into public.requisition_return_items (return_id, variant_id, quantity)
    values (v_return_id, (it.value->>'variant_id')::uuid, (it.value->>'quantity')::int);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'requisition.return', 'requisition', p_requisition_id, jsonb_build_object('items', p_items));
end;
$$;
```

- [ ] **Step 2: Áp migration + chạy bootstrap + kiểm tra schema**

Run: `bunx supabase db reset` → `bun run scripts/bootstrap.ts`
Run:
```bash
docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -c "\d public.requisition_returns" -c "\d public.requisition_return_items"
```
Expected: 2 bảng đúng cột, đã enable RLS.
```bash
docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -c "select policyname from pg_policies where tablename in ('requisition_returns','requisition_return_items') order by tablename;"
```
Expected: `requisition_returns_select`, `requisition_return_items_select`.
```bash
docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -c "select prosrc from pg_proc where proname='return_requisition_items';" | grep -c "requisition_returns"
```
Expected: `1` (body RPC đã tham chiếu bảng mới).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0032_requisition_returns.sql
git commit -m "feat(db): lịch sử trả lại vật tư — bảng 0032 + RLS select manager/owner; RPC ghi header + dòng"
```

---

### Task 2: Regen database types

**Files:**
- Modify: `src/types/database.types.ts` (regenerated)

**Interfaces:**
- Produces: Row/Insert/Update types cho `requisition_returns`, `requisition_return_items` (+ Relationships) — dùng bởi Task 3, Task 4.

- [ ] **Step 1: Regenerate types**

Run: `bunx supabase gen types typescript --local > src/types/database.types.ts`

- [ ] **Step 2: Xác nhận type mới có mặt + typecheck**

Run:
```bash
grep -n "requisition_returns:" src/types/database.types.ts | head -2
bun run typecheck
```
Expected: ít nhất 1 dòng `requisition_returns:` trong `Tables`; typecheck PASS.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "chore(types): regen database types — bảng requisition_returns/return_items"
```

---

### Task 3: Trang chi tiết phiếu — card "Lịch sử trả lại" + số đã trả trên dòng

**Files:**
- Modify: `src/app/(app)/requisitions/[id]/page.tsx`
- Modify: `src/features/requisitions/components/return-items.tsx`
- Modify: `src/features/requisitions/components/material-items-view.tsx`

**Interfaces:**
- Consumes: types Task 2; RPC Task 1 (qua action `returnRequisitionItems` — hành vi action không đổi).
- Produces: `MaterialItemView.returned: number`; `ReturnItems` prop items mới có `returned: number`; card "Lịch sử trả lại" server-render trên trang chi tiết.

- [ ] **Step 1: Truy vấn lịch sử + tính returnedByVariant trên page**

Trong `src/app/(app)/requisitions/[id]/page.tsx`, ngay sau khối khai báo `materialItems` hiện có, thêm:

```tsx
const { data: returnEvents } = await supabase
  .from("requisition_returns")
  .select(
    "id, returned_by, created_at, returnedBy:profiles!requisition_returns_returned_by_fkey(name), items:requisition_return_items(variant_id, quantity, variants(attributes, unit, products(name)))",
  )
  .eq("requisition_id", id)
  .order("created_at", { ascending: false });

// Tổng đã trả theo variant (qua mọi sự kiện) — dùng cho form trả và dòng vật tư.
const returnedByVariant = new Map<string, number>();
for (const ev of returnEvents ?? []) {
  for (const it of (ev as { items?: { variant_id: string; quantity: number }[] }).items ?? []) {
    returnedByVariant.set(it.variant_id, (returnedByVariant.get(it.variant_id) ?? 0) + it.quantity);
  }
}
```

(Dùng cast an toàn như các embed khác trong file; supabase types sau Task 2 sẽ gợi ý shape đúng.)

- [ ] **Step 2: MaterialItemView thêm `returned` và hiển thị "đã trả"**

`src/features/requisitions/components/material-items-view.tsx`:
- Thêm `returned: number` vào interface `MaterialItemView` (sau `quantity`).
- Ở row item, bên phải cạnh `SL: {it.quantity}`, hiển thị thêm khi đã trả:

```tsx
<div className="flex shrink-0 flex-col items-end gap-0.5">
  <span className="text-sm font-medium tabular-nums">SL: {it.quantity}</span>
  {it.returned > 0 ? (
    <span className="text-xs text-muted-foreground">đã trả {it.returned}</span>
  ) : null}
</div>
```

- [ ] **Step 3: Truyền `returned` vào materialItems**

Trong page, map `materialItems` (khối đã có) thêm `returned: returnedByVariant.get(i.variant_id) ?? 0,` — chú ý `returnedByVariant` phải khai báo **trước** `materialItems` (di chuyển Step 1 lên trước khối map nếu cần).

- [ ] **Step 4: Truyền `returned` vào form trả**

Trong page, block truyền `ReturnItems` thêm trường `returned`:

```tsx
items={(items ?? []).map((i) => ({
  id: i.id,
  variantId: i.variant_id,
  label: `${i.variants?.products?.name ?? "Vật tư"} — ${variantLabel(i.variants?.attributes, i.variants?.unit)}`,
  quantity: i.quantity,
  returned: returnedByVariant.get(i.variant_id) ?? 0,
}))}
```

- [ ] **Step 5: Form trả cap "đã cấp − đã trả" + refresh sau khi trả**

`src/features/requisitions/components/return-items.tsx`:
- Thêm `returned: number` vào `interface Item`.
- Đầu file thêm `import { useRouter } from "next/navigation";` và `const router = useRouter();`.
- Mỗi dòng:

```tsx
const remaining = Math.max(0, i.quantity - i.returned);
// ...
<span className="min-w-0 flex-1 truncate text-sm">{i.label}</span>
<span className="shrink-0 text-xs text-muted-foreground">
  đã cấp {i.quantity} · đã trả {i.returned}
</span>
<Input
  type="number"
  min="0"
  max={remaining}
  disabled={remaining <= 0}
  className="w-24"
  value={remaining <= 0 ? "" : (qty[i.id] ?? "")}
  onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
  placeholder={remaining <= 0 ? "Hết" : "Số trả"}
/>
```

- Trong `submit()`: bỏ qua dòng `remaining <= 0`; sau `await returnRequisitionItems(...)` thành công thêm `router.refresh();`.

- [ ] **Step 6: Render card "Lịch sử trả lại"**

Trong page, sau card "Trả lại vật tư không dùng hết" (trước card "Tiến trình"), chèn:

```tsx
{returnEvents && returnEvents.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Lịch sử trả lại</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {returnEvents.map((ev) => {
        const evItems = (ev as { items?: { variant_id: string; quantity: number; variants?: { attributes?: unknown; unit?: string | null; products?: { name?: string | null } | null } | null }[] }).items ?? [];
        return (
          <div key={ev.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{(ev as { returnedBy?: { name?: string | null } | null }).returnedBy?.name ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{formatDate(ev.created_at)}</span>
            </div>
            <div className="mt-2 space-y-1">
              {evItems.map((it, idx) => (
                <div key={idx} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {it.variants?.products?.name ?? "Vật tư"}
                    <span className="text-muted-foreground"> · {variantLabel(it.variants?.attributes, it.variants?.unit)}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">× {it.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </CardContent>
  </Card>
)}
```

- [ ] **Step 7: Typecheck + lint**

Run: `bun run typecheck` && `bun run lint`
Expected: PASS cả hai.

- [ ] **Step 8: Kiểm tra trang (manual)**

Với manager/requester đã đăng nhập, mở `/requisitions/<id>` phiếu ở `issued` và thực hiện trả 2/5 → sau refresh:
- Card "Lịch sử trả lại" hiện 1 sự kiện (người trả, thời gian, `Tên vật tư · biến thể × 2`).
- Dòng vật tư hiện `SL: 5 · đã trả 2`.
- Form trả hiện `đã cấp 5 · đã trả 2`, ô nhập cap 3.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/requisitions/[id]/page.tsx" "src/features/requisitions/components/return-items.tsx" "src/features/requisitions/components/material-items-view.tsx"
git commit -m "feat(requisitions): card Lịch sử trả lại cho owner+manager; số đã trả trên dòng; form trả cap theo còn lại"
```

---

### Task 4: Verify script end-to-end

**Files:**
- Create: `scripts/verify-return-history.ts`

**Interfaces:**
- Consumes: RPC Task 1, bảng Task 1.
- Produces: script chạy `bun run scripts/verify-return-history.ts` — PASS nếu toàn bộ assertion đúng.

- [ ] **Step 1: Viết script** (mô phỏng `scripts/verify-requisition-flow.ts`)

```ts
// scripts/verify-return-history.ts — kiểm chứng luồng trả lại vật tư ghi lịch sử.
// Chạy: bun run scripts/bootstrap.ts && bun run scripts/verify-return-history.ts
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function client(token: string) {
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
}
function ok(c: boolean, m: string) {
  console.log(c ? "ok:" : "FAIL:", m);
  if (!c) process.exit(1);
}

const api = createClient(URL, ANON);
const r = await api.auth.signInWithPassword({ email: "requester@mtp.local", password: "password123" });
const m = await api.auth.signInWithPassword({ email: "manager@mtp.local", password: "password123" });
if (r.error || m.error) throw new Error("sign-in failed");
const rc = client(r.data.session!.access_token);
const mc = client(m.data.session!.access_token);
const requesterId = r.data.user!.id;
const managerId = m.data.user!.id;

const { data: zone } = await rc.from("zones").select("id").limit(1).single();
const { data: variant } = await rc.from("variants").select("id").limit(1).single();
ok(!!zone?.id && !!variant?.id, "có zone + variant");

const created = await rc.rpc("create_requisition", {
  p_items: [{ variant_id: variant!.id, quantity: 5 }],
  p_zone_id: zone!.id,
  p_purpose: "Verify lịch sử trả lại",
  p_type: "new_supply",
  p_linked_defect_id: null,
  p_requester_id: requesterId,
});
if (created.error) throw created.error;
const rid = created.data as string;
if ((await rc.rpc("submit_requisition", { p_id: rid })).error) throw new Error("submit fail");
if ((await mc.rpc("approve_requisition", { p_id: rid, p_by: managerId })).error) throw new Error("approve fail");
if ((await mc.rpc("fulfill_requisition", { p_id: rid, p_by: managerId, p_notes: "verify" })).error)
  throw new Error("fulfill fail");

// Trả 2/5 (requester — owner được quyền trả theo 0023)
const ret = await rc.rpc("return_requisition_items", {
  p_requisition_id: rid,
  p_items: [{ variant_id: variant!.id, quantity: 2 }],
  p_by: requesterId,
});
if (ret.error) throw ret.error;
console.log("đã trả 2/5");

// Trả vượt (4 > còn lại 3) phải bị chặn
const over = await rc.rpc("return_requisition_items", {
  p_requisition_id: rid,
  p_items: [{ variant_id: variant!.id, quantity: 4 }],
  p_by: requesterId,
});
ok(!!over.error, "trả vượt số còn lại bị chặn: " + (over.error?.message ?? ""));

// Lịch sử: requester (owner) đọc được
const { data: events, error: evErr } = await rc
  .from("requisition_returns")
  .select("id, returned_by, items:requisition_return_items(variant_id, quantity)")
  .eq("requisition_id", rid);
ok(!evErr, "requester đọc được requisition_returns");
ok(events?.length === 1, `có đúng 1 sự kiện trả (thực tế ${events?.length})`);
const totalReturned = (events?.[0] as { items?: { quantity: number }[] } | undefined)?.items?.reduce(
  (n, x) => n + x.quantity, 0);
ok(totalReturned === 2, `tổng số lượng trả = 2 (thực tế ${totalReturned})`);

// stock_movements có return_in đúng 2
const { data: mv } = await mc
  .from("stock_movements")
  .select("movement_type, quantity")
  .eq("ref_type", "requisition")
  .eq("ref_id", rid)
  .eq("movement_type", "return_in");
ok((mv ?? []).reduce((n, x) => n + x.quantity, 0) === 2, "stock_movements return_in tổng = 2");

console.log("PASS");
```

- [ ] **Step 2: Chạy và xác nhận PASS**

Run: `bun run scripts/verify-return-history.ts`
Expected: toàn bộ dòng `ok:...`, cuối là `PASS`. Nếu `FAIL`, dừng và sửa.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-return-history.ts
git commit -m "test(requisitions): verify script luồng trả lại + lịch sử"
```

---

### Task 5: Kiểm tra toàn cục + push git

**Files:**
- Không đổi file.

- [ ] **Step 1: Chạy đủ bộ kiểm tra**

Run: `bun run typecheck` && `bun run lint` && `bun run test` && `bun run scripts/verify-return-history.ts`
Expected: tất cả PASS.

- [ ] **Step 2: Kiểm tra working tree chỉ gồm file của plan**

Run: `git status --short`
Expected: chỉ các file: `supabase/migrations/0032_requisition_returns.sql`, `src/types/database.types.ts`, `src/app/(app)/requisitions/[id]/page.tsx`, `src/features/requisitions/components/return-items.tsx`, `src/features/requisitions/components/material-items-view.tsx`, `scripts/verify-return-history.ts`, `docs/superpowers/plans/2026-09-05-return-history.md`, `docs/superpowers/specs/2026-09-05-return-history-design.md`.

- [ ] **Step 3: Push**

```bash
git push origin main
```
