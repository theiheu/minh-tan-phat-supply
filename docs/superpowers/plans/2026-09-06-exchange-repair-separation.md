# Tách Đổi Mới khỏi phiếu yêu cầu + tích hợp đề nghị sửa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Luồng "đổi trả đồ hỏng / lấy đồ mới" không còn tạo phiếu yêu cầu loại `replacement` — thay bằng Phiếu Đổi Mới (`exchange_notes`, mã `DM-xxxx`, vòng đời pending→approved→issued→received + rejected/cancelled) do manager xử lý trọn gói trong trang Vật tư hỏng; đồng thời người lập HONG có thể "đề nghị sửa" để manager xác nhận qua luồng `send_to_repair` sẵn có.

**Architecture:** 3 migration mới (0046: bảng DM + RLS; 0047: `exchange_out` + RPC DM theo pattern security definer/FOR UPDATE/audit; 0048: cờ `repair_requested_*` trên defect_notes + RPC request/cancel + sửa `send_to_repair` xoá cờ). Feature `src/features/exchanges/` mới (actions + nút tạo + bảng manager + detail actions). `/defects`: chip trạng thái DM/đề nghị sửa trên dòng HONG + toggle manager. Chi tiết DM ở `/defects/exchange/[id]` (manager). Chặn tạo mới `replacement` trong module requisitions (form/schema/actions/list). Dữ liệu cũ giữ nguyên, không migrate.

**Tech Stack:** Next.js 15 App Router · Supabase local (RPC + RLS + Storage) · TypeScript strict · Zod · shadcn/ui · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-09-06-exchange-repair-separation-design.md`

## Global Constraints

- Chạy từ repo root `/home/thehi/minh-tan-phat-supply`; Supabase local đang chạy (container `supabase_db_minh-tan-phat-supply`).
- CLI: `/home/thehi/.bun/install/cache/@supabase/cli-linux-x64@2.116.0@@@1/bin/supabase` (env `HOME/XDG_CACHE_HOME/TMPDIR` trỏ vào `.tmp/` để tránh sandbox chặn).
- psql: `docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "<sql>"`.
- Mọi thay đổi stock/trạng thái chạy qua RPC `security definer`; `select ... for update`; order theo `variant_id` chống deadlock; ghi `audit_logs`.
- RLS bảng DM: chỉ SELECT (manager hoặc chủ HONG liên kết); không policy INSERT/UPDATE/DELETE.
- Gate 1 HONG = 1 hướng: DM sống (pending/approved/issued/received) hoặc cờ đề nghị sửa → chặn hướng kia.
- Conventional Commits; mỗi task chạy `bun run typecheck` rồi commit riêng; KHÔNG `git add` các file sửa dở ngoài phạm vi hiện có.
- Supabase local dev: reset DB là chấp nhận được (`bunx supabase db reset` pattern repo; seed lại qua `bun run scripts/bootstrap.ts` nếu cần).

---

### Task 1: Migration 0046 — bảng `exchange_notes` + `exchange_note_items` + RLS

**Files:**
- Create: `supabase/migrations/0046_exchange_notes.sql`

**Interfaces:**
- Produces: enum `public.exchange_status`, sequence `exchange_notes_seq`, 2 bảng + index + RLS. Dùng bởi Task 2 (RPC) + Task 5+ (types/UI).

- [ ] **Step 1: Tạo migration** (nội dung SQL theo spec mục 4.1 — copy nguyên từ spec)

```sql
create type public.exchange_status as enum
  ('pending','approved','issued','received','rejected','cancelled');
create sequence public.exchange_notes_seq;

create table public.exchange_notes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  linked_defect_id uuid not null references public.defect_notes(id),
  status public.exchange_status not null default 'pending',
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  issued_by uuid references public.profiles(id),
  received_by uuid references public.profiles(id),
  rejected_by uuid references public.profiles(id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  issued_at timestamptz,
  received_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz
);

create table public.exchange_note_items (
  id uuid primary key default gen_random_uuid(),
  exchange_note_id uuid not null references public.exchange_notes(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity int not null check (quantity > 0)
);

create index exchange_notes_defect_idx on public.exchange_notes(linked_defect_id);
create index exchange_note_items_note_idx on public.exchange_note_items(exchange_note_id);

create unique index exchange_notes_active_unique
  on public.exchange_notes (linked_defect_id)
  where status in ('pending','approved','issued','received');

alter table public.exchange_notes enable row level security;
alter table public.exchange_note_items enable row level security;

create policy "exchange_notes_select" on public.exchange_notes for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.defect_notes d
    where d.id = linked_defect_id and d.reported_by = auth.uid()
  ));
create policy "exchange_note_items_select" on public.exchange_note_items for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.exchange_notes en
    join public.defect_notes d on d.id = en.linked_defect_id
    where en.id = exchange_note_id and d.reported_by = auth.uid()
  ));
```

- [ ] **Step 2: Apply** — copy file vào container rồi chạy psql, hoặc `docker exec -i ... psql < file`:
```bash
docker exec -i supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/0046_exchange_notes.sql
```
Expected: không lỗi; kiểm `\dt exchange_notes`.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0046_exchange_notes.sql
git commit -m "feat(db): bảng phiếu Đổi Mới exchange_notes + items + RLS (mã DM)"
```

---

### Task 2: Migration 0047 — `movement_type 'exchange_out'` + 6 RPC phiếu Đổi Mới

**Files:**
- Create: `supabase/migrations/0047_exchange_rpc.sql`

**Interfaces:**
- Consumes: Task 1 (bảng/exchange_status), `_expand_variant_demand` (0036), `_move_stock`, `next_code`, `is_manager`, `stock_locations('KHO_CHINH')`.
- Produces: RPC `create_exchange`, `approve_exchange`, `reject_exchange`, `issue_exchange`, `receive_exchange`, `cancel_exchange`.

- [ ] **Step 1: Tạo migration** (bám sát style 0017; audit action prefix `exchange.*`, entity_type `exchange`):

```sql
-- 0047_exchange_rpc.sql — nghiệp vụ phiếu Đổi Mới (manager xử lý trọn gói)
alter type public.movement_type add value if not exists 'exchange_out';

-- Tạo phiếu Đổi Mới từ phiếu HONG staging (owner hoặc manager)
create or replace function public.create_exchange(p_defect_id uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if not exists (
    select 1 from public.defect_notes d
    where d.id = p_defect_id and d.status = 'staging'
      and (d.reported_by = p_by or public.is_manager())
  ) then
    raise exception 'Phiếu hỏng không tồn tại, không ở trạng thái tập kết, hoặc bạn không có quyền';
  end if;
  if exists (select 1 from public.defect_notes d
             where d.id = p_defect_id and d.repair_requested_at is not null) then
    raise exception 'Phiếu hỏng đang chờ xác nhận sửa — không tạo phiếu Đổi Mới được';
  end if;
  -- Mỗi dòng HONG phải đủ chứng cứ
  if exists (
    select 1 from public.defect_note_items dni
    where dni.defect_note_id = p_defect_id
      and (dni.damage_detail is null or dni.images is null or array_length(dni.images,1) is null or array_length(dni.images,1) = 0)
  ) then
    raise exception 'Phiếu hỏng chưa đủ thông tin/ảnh — cần bổ sung trước khi đổi mới';
  end if;

  begin
    insert into public.exchange_notes (code, linked_defect_id, created_by)
    select public.next_code('DM','public.exchange_notes_seq'::regclass), d.id, p_by
    from public.defect_notes d where d.id = p_defect_id
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Phiếu hỏng này đã có phiếu Đổi Mới đang xử lý';
  end;

  insert into public.exchange_note_items (exchange_note_id, variant_id, quantity)
  select v_id, dni.variant_id, dni.quantity
  from public.defect_note_items dni where dni.defect_note_id = p_defect_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'exchange.create', 'exchange', v_id, jsonb_build_object('status','pending'));
  return v_id;
end;
$$;

create or replace function public.approve_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.exchange_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được duyệt'; end if;
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'pending' then raise exception 'Phiếu không ở trạng thái đang chờ (hiện tại: %)', v_status; end if;
  update public.exchange_notes set status='approved', approved_by=p_by, approved_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.approve', 'exchange', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','approved'));
end;
$$;

create or replace function public.reject_exchange(p_id uuid, p_by uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.exchange_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được từ chối'; end if;
  if p_reason is null or length(trim(p_reason))=0 then raise exception 'Phải nhập lý do từ chối'; end if;
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'pending' then raise exception 'Chỉ từ chối phiếu đang chờ (hiện tại: %)', v_status; end if;
  update public.exchange_notes set status='rejected', rejected_by=p_by, rejection_reason=p_reason, rejected_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.reject', 'exchange', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','rejected'));
end;
$$;

create or replace function public.issue_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.exchange_status;
  v_main uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được cấp phát'; end if;
  select id into v_main from public.stock_locations where code='KHO_CHINH';
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'approved' then raise exception 'Phiếu chưa được duyệt (hiện tại: %)', v_status; end if;
  for it in
    select d.variant_id, d.quantity from public._expand_variant_demand(
      (select jsonb_agg(jsonb_build_object('variant_id', i.variant_id, 'quantity', i.quantity))
       from public.exchange_note_items i where i.exchange_note_id = p_id)
    ) d order by d.variant_id
  loop
    perform public._move_stock(it.variant_id, v_main, null, it.quantity, 'exchange_out', 'exchange', p_id, p_by);
  end loop;
  update public.exchange_notes set status='issued', issued_by=p_by, issued_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.issue', 'exchange', p_id,
          jsonb_build_object('status','approved'), jsonb_build_object('status','issued'));
end;
$$;

create or replace function public.receive_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.exchange_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được xác nhận nhận'; end if;
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'issued' then raise exception 'Phiếu chưa cấp phát (hiện tại: %)', v_status; end if;
  update public.exchange_notes set status='received', received_by=p_by, received_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.receive', 'exchange', p_id,
          jsonb_build_object('status','issued'), jsonb_build_object('status','received'));
end;
$$;

create or replace function public.cancel_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.exchange_status;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'pending' then raise exception 'Chỉ huỷ phiếu đang chờ (hiện tại: %)', v_status; end if;
  if not (public.is_manager() or exists (
    select 1 from public.exchange_notes en
    join public.defect_notes d on d.id = en.linked_defect_id
    where en.id = p_id and d.reported_by = p_by
  )) then raise exception 'Bạn không có quyền huỷ phiếu này'; end if;
  update public.exchange_notes set status='cancelled', cancelled_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.cancel', 'exchange', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','cancelled'));
end;
$$;
```

- [ ] **Step 2: Apply** (như Task 1) + kiểm: `\df create_exchange`; `select enum_range(null::public.movement_type)` có `exchange_out`.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0047_exchange_rpc.sql
git commit -m "feat(db): RPC phiếu Đổi Mới + movement exchange_out (create/approve/reject/issue/receive/cancel)"
```

---

### Task 3: Migration 0048 — đề nghị sửa từ HONG

**Files:**
- Create: `supabase/migrations/0048_repair_request.sql`

**Interfaces:**
- Consumes: bảng `defect_notes`, `send_to_repair` (0017, cần create or replace), `exchange_notes` (Task 1).
- Produces: cột `defect_notes.repair_requested_by/at`; RPC `request_repair`, `cancel_repair_request`; `send_to_repair` mới xoá cờ.

- [ ] **Step 1: Tạo migration**:

```sql
-- 0048_repair_request.sql — đề nghị gửi đi sửa từ người lập HONG
alter table public.defect_notes
  add column repair_requested_by uuid references public.profiles(id),
  add column repair_requested_at timestamptz;

-- Người lập HONG (hoặc manager) đề nghị sửa
create or replace function public.request_repair(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.defect_status;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status into v_status from public.defect_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu hỏng'; end if;
  if v_status <> 'staging' then raise exception 'Chỉ phiếu đang tập kết mới đề nghị sửa (hiện tại: %)', v_status; end if;
  if not (public.is_manager() or exists (select 1 from public.defect_notes d where d.id=p_id and d.reported_by=p_by)) then
    raise exception 'Bạn không có quyền đề nghị cho phiếu này';
  end if;
  if exists (select 1 from public.defect_notes d where d.id=p_id and d.repair_requested_at is not null) then
    raise exception 'Phiếu này đã được đề nghị sửa';
  end if;
  if exists (select 1 from public.exchange_notes en
             where en.linked_defect_id=p_id and en.status in ('pending','approved','issued','received')) then
    raise exception 'Phiếu này đang có phiếu Đổi Mới — không đề nghị sửa được';
  end if;
  update public.defect_notes set repair_requested_by=p_by, repair_requested_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.repair_request', 'defect', p_id, jsonb_build_object('status','staging','requested',true));
end;
$$;

create or replace function public.cancel_repair_request(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.defect_status;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status into v_status from public.defect_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu hỏng'; end if;
  if v_status <> 'staging' then raise exception 'Chỉ huỷ đề nghị khi phiếu còn tập kết'; end if;
  if not (public.is_manager() or exists (select 1 from public.defect_notes d where d.id=p_id and d.reported_by=p_by)) then
    raise exception 'Bạn không có quyền huỷ đề nghị này';
  end if;
  update public.defect_notes set repair_requested_by=null, repair_requested_at=null where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.repair_request_cancel', 'defect', p_id, jsonb_build_object('requested',false));
end;
$$;
```

- [ ] **Step 2: Sửa `send_to_repair` để xoá cờ** (create or replace, giữ nguyên toàn bộ logic cũ — copy thân hàm từ 0017; chỉ thêm update cờ ở cuối, sau khi set `in_repair`):
```sql
  update public.defect_notes set repair_requested_by=null, repair_requested_at=null
  where id in (select distinct defect_note_id from public.defect_note_items where id = any(p_defect_item_ids));
```
(chèn trước `insert into public.audit_logs ... 'repair.create'`).

- [ ] **Step 3: Apply + Commit**
```bash
docker exec -i supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/0048_repair_request.sql
git add supabase/migrations/0048_repair_request.sql
git commit -m "feat(db): đề nghị gửi đi sửa từ HONG (request/cancel) + send_to_repair xoá cờ"
```

---

### Task 4: Regen types

- [ ] **Step 1:**
```bash
export HOME=/home/thehi/minh-tan-phat-supply/.tmp/bunhome XDG_CACHE_HOME=/home/thehi/minh-tan-phat-supply/.tmp/buncache TMPDIR=/home/thehi/minh-tan-phat-supply/.tmp/buntmp
/home/thehi/.bun/install/cache/@supabase/cli-linux-x64@2.116.0@@@1/bin/supabase gen types typescript --local > src/types/database.types.ts
```
Expected: file có `exchange_notes`, `exchange_note_items`, `exchange_status`, `repair_requested_by/at`, `exchange_out`, RPC mới.

- [ ] **Step 2:** `bun run typecheck` (đảm bảo 5 file sửa dở cũ vẫn pass; KHÔNG sửa chúng). Commit.

---

### Task 5: Labels

**Files:**
- Modify: `src/lib/labels.ts`

- [ ] **Step 1:** thêm `EXCHANGE_STATUS` (pending Đang chờ / approved Đã duyệt / issued Đã cấp phát / received Đã nhận / rejected Từ chối / cancelled Đã hủy) + `MOVEMENT_TYPE.exchange_out: "Cấp đổi mới"`.
- [ ] **Step 2:** typecheck + commit `feat(labels): EXCHANGE_STATUS + movement exchange_out`.

---

### Task 6: Feature exchanges — actions + components

**Files:**
- Create: `src/features/exchanges/actions.ts`
- Create: `src/features/exchanges/components/exchange-request-button.tsx`
- Create: `src/features/exchanges/components/exchange-manager-tab.tsx`
- Create: `src/features/exchanges/components/exchange-detail-actions.tsx`
- Delete: `src/features/defects/exchange-action.ts`
- Delete: `src/features/defects/components/exchange-request-button.tsx` (thay bằng bản mới ở exchanges)

**Interfaces:**
- Consumes: RPC Task 2; pattern `safeNotify` (copy từ `features/requisitions/actions.ts`), `requireProfile`, `isPrivileged`.
- Produces: `createExchange(noteId): Promise<{id:string; code:string}>`; `approveExchange/rejectExchange(id,reason)/issueExchange/receiveExchange/cancelExchange(id): Promise<void>`; components dùng cho /defects + /defects/exchange/[id].

- [ ] **Step 1: actions.ts** — mỗi hàm: requireProfile, gọi RPC, notify (manager khi create; người lập HONG khi approve/issue/receive/reject qua `linked_defect_id → defect_notes.reported_by`), revalidate `/defects`, `/products` (khi issue). `createExchange`: RPC trả về id → select `code` từ `exchange_notes` → return `{ id, code }` để toast.
- [ ] **Step 2: exchange-request-button.tsx** — client; nhận `noteId`, `isManager`, `hasLive`, `hasRepairRequest`; ẩn nút khi `hasLive || hasRepairRequest`; gọi `createExchange`; toast `Đã tạo phiếu Đổi Mới ${code}`; nếu isManager → push `/defects/exchange/<id>`; không thì `router.refresh()`.
- [ ] **Step 3: exchange-manager-tab.tsx** — client (hoặc server component nhận rows): bảng DM; dòng: mã DM (link chi tiết), mã HONG, người lập (name), ngày, badge status, nút Mở.
- [ ] **Step 4: exchange-detail-actions.tsx** — client; props `{id, status, isManager}`; render theo trạng thái: pending → Duyệt / Từ chối (dialog reason) / Huỷ; approved → Cấp phát; issued → Xác nhận nhận; gọi actions + toast + `router.refresh()`.
- [ ] **Step 5:** typecheck + lint + commit `feat(exchanges): actions + UI phiếu Đổi Mới`.

---

### Task 7: /defects — chip trạng thái + toggle manager

**Files:**
- Modify: `src/app/(app)/defects/page.tsx`

- [ ] **Step 1:** bỏ query `activeReqs` (requisitions). Thay bằng load exchange liên kết: `supabase.from("exchange_notes").select("id, code, status, linked_defect_id").in("linked_defect_id", noteIds)` → `liveByNote`. Trong rows HONG: chip khi có live DM (`Đổi mới: <status label>`) + chip "Chờ xác nhận sửa" khi `repair_requested_at`.
- [ ] **Step 2:** toggle manager: `searchParams.view` (`exchange`) — nếu manager và `view=exchange` → render `ExchangeManagerTab` thay bảng HONG (giữ filter riêng hoặc đơn giản bảng DM). Header thêm nút chuyển chế độ (chỉ manager).
- [ ] **Step 3:** thay `<ExchangeRequestButton>` bằng bản từ `features/exchanges`; truyền props mới (`noteId`, `isManager`, `hasLive`, `hasRepairRequest`).
- [ ] **Step 4:** typecheck + commit `feat(defects): chip trạng thái Đổi Mới/đề nghị sửa + toggle manager phiếu Đổi Mới`.

---

### Task 8: Trang chi tiết DM `/defects/exchange/[id]`

**Files:**
- Create: `src/app/(app)/defects/exchange/[id]/page.tsx`
- Modify: (nếu cần) `src/lib/types.ts` cho role gate — tham chiếu `isPrivileged`.

- [ ] **Step 1:** server component `requireManager()`-equivalent (dùng `getCurrentProfile` + `isPrivileged`, redirect về `/defects` nếu không phải manager). Load exchange + items + HONG + actor names + images (`appAssetUrl`).
- [ ] **Step 2:** render header (mã DM, badge, mã HONG, người lập, ngày), thẻ Vật tư (tên+biến thể+SL), thẻ "Vật tư hỏng liên quan" (bảng dòng HONG: mô tả, ảnh thumb), tiến trình (created/approved/issued/received/rejected/cancelled kèm `*_at`), `ExchangeDetailActions`.
- [ ] **Step 3:** typecheck + commit `feat(exchanges): trang chi tiết phiếu Đổi Mới (manager)`.

---

### Task 9: Đề nghị sửa UI trên HONG

**Files:**
- Modify: `src/features/defects/actions.ts` (thêm `requestRepair`, `cancelRepairRequest`)
- Modify: `src/features/defects/components/defect-actions.tsx` (props `isOwner`, `repairRequested`, `canManage`)
- Modify: `src/app/(app)/defects/page.tsx` (truyền props)

- [ ] **Step 1:** actions mới gọi RPC Task 3 + revalidate `/defects` + notify manager khi có đề nghị.
- [ ] **Step 2:** defect-actions: staging & isOwner (hoặc manager) → nút "Đề nghị sửa" (nếu chưa cờ) / chip + "Hủy đề nghị" (nếu cờ). Nút "Đưa đi sửa" (manager) đổi nhãn "Xác nhận sửa" khi có cờ. Manager giữ khả năng đưa đi sửa trực tiếp.
- [ ] **Step 3:** page truyền `isOwner`, `repairRequested`, `canManage`. Typecheck + commit.

---

### Task 10: Chặn replacement mới trong module requisitions

**Files:**
- Modify: `src/features/requisitions/schema.ts` (bỏ requisitionType/linkedDefectId/superRefine)
- Modify: `src/features/requisitions/actions.ts` (`p_type:'new_supply'`, `p_linked_defect_id:null`)
- Modify: `src/features/requisitions/components/requisition-form.tsx` (bỏ type/defectId state + ô UI + prop defects)
- Modify: `src/app/(app)/requisitions/new/page.tsx` (bỏ load defects)
- Modify: `src/app/(app)/requisitions/page.tsx` (bỏ filter type; giữ label legacy)

- [ ] **Step 1–5:** sửa từng file; typecheck; commit `feat(requisitions): chỉ còn loại cấp mới — bỏ tạo replacement (dữ liệu cũ giữ nguyên)`.

---

### Task 11: Verify + QA

**Files:**
- Create: `scripts/verify-exchange-repair.ts`

- [ ] **Step 1:** script kiểm: HONG staging đủ ảnh → create_exchange (DM pending, đúng items) → approve → issue (stock Kho chính giảm + ledger exchange_out) → receive; test âm gate (thiếu ảnh / trùng DM / repair_requested chặn DM / request_repair khi có DM chặn); send_to_repair xoá cờ.
- [ ] **Step 2:** `bun run lint`, `bun run typecheck`, `bun run test`; QA thủ công browser 2 vai.
- [ ] **Step 3:** cập nhật BUILD_GUIDE 15.6 nếu cần; commit cuối.
