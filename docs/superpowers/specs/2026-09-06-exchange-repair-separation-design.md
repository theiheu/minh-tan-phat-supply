# Tách Đổi Mới ra khỏi phiếu yêu cầu + tích hợp đề nghị sửa — Design

- Ngày: 2026-09-06
- Trạng thái: Thiết kế đã được người dùng duyệt (2026-09-06); chờ rà soát spec
- Phạm vi: features `defects`, `requisitions`, `repairs`; migration mới `0046–0048`

## 1. Bối cảnh & mục tiêu

Luồng "đổi trả đồ hỏng / lấy đồ mới" hiện đang **ăn theo phiếu yêu cầu**: nút "Tạo yêu cầu đổi mới" trên phiếu HONG tạo một `requisitions` loại `replacement` (`linked_defect_id`), chạy trọn vòng đời phiếu yêu cầu (gửi → duyệt → cấp → nhận) và **lẫn vào danh sách `/requisitions`**. Form "Tạo phiếu yêu cầu" cũng có ô chọn Loại phiếu = Cấp mới | Đổi mới.

Người dùng muốn:
1. **Tách hẳn** luồng đổi mới ra khỏi phiếu yêu cầu → loại phiếu riêng **Phiếu Đổi Mới** (mã `DM-xxxx`), có vòng đời + màn hình riêng, vẫn liên kết phiếu HONG và vẫn **xuất kho cấp vật tư mới** khi hoàn tất.
2. **Thêm hướng "gửi đồ hỏng đi sửa"**: người lập HONG **đề nghị** gửi đi sửa, manager **xác nhận** (đơn vị sửa + ngày) → tạo phiếu sửa `SC` như luồng hiện có — **gom điểm khởi tạo** 2 hướng (Đổi Mới / Sửa) ngay trên HONG, giữ màn hình chi tiết riêng.
3. **Đồ hỏng giữ nguyên ở Kho hỏng** khi đổi mới (không tự xoá/thanh lý — manager tự quyết sau); chỉ chuyển sang Kho đang sửa khi thực sự xác nhận sửa.

### Quyết định đã chốt với người dùng
1. Phiếu Đổi Mới là loại phiếu **riêng hẳn** (bảng mới), không còn là phiếu yêu cầu.
2. Vòng đời phiếu Đổi Mới: `pending` (tạo thẳng, không nháp) → `approved` → `issued` → `received`; hỗ trợ `rejected` (kèm lý do) và `cancelled`; sau huỷ/từ chối tạo lại được.
3. Người lập HONG (hoặc manager) bấm "Tạo phiếu Đổi Mới" → **manager xử lý trọn gói** (duyệt / cấp / nhận / từ chối / huỷ). Người lập HONG không cần mở phiếu đổi mới — theo dõi qua chip trạng thái trên dòng HONG.
4. Quản lý phiếu Đổi Mới nằm trong trang **Vật tư hỏng `/defects`**: toggle chỉ manager thấy **[Phiếu hỏng | Phiếu đổi mới]**; chi tiết mở ở **`/defects/exchange/[id]`** (manager-only). Không thêm mục nav chung.
5. "Gửi đi sửa": người lập HONG đề nghị (cờ trên HONG), manager xác nhận qua luồng `send_to_repair` sẵn có.
6. Dữ liệu cũ (phiếu `replacement` trong requisitions): **để nguyên hiển thị như lịch sử**, chỉ chặn tạo mới; không migrate. Khối chứng cứ HONG trên trang chi tiết phiếu yêu cầu giữ nguyên (chỉ còn phục vụ dữ liệu legacy).
7. Phạm vi đồ hỏng: **nội bộ** (người dùng trong trại/khu), không gồm khách hàng trả hàng.

## 2. Hiện trạng liên quan (đã rà)

- `defect_notes` (HONG): `status` enum `staging | in_repair | returned | liquidated | cancelled`; items `defect_note_items` có `damage_detail`, `damage_type`, `severity`, `images text[]`, `unit_cost`, `resolution`.
- `record_defect` (RPC): Kho nguồn −qty → Kho hỏng +qty (`defect_out`), audit `defect.record`.
- `requisitions`: có `requisition_type enum ('new_supply','replacement')`, `linked_defect_id`, status `draft..cancelled`. `create_requisition` nhận `p_type`, `p_linked_defect_id`; code `REQ-xxxx`. Unique index 0031 chống trùng replacement theo `linked_defect_id` (mọi trạng thái).
- `src/features/defects/exchange-action.ts` (`createReplacementRequest`) + `components/exchange-request-button.tsx`: từ HONG `staging` + đủ ảnh → gọi `create_requisition` type replacement, redirect `/requisitions/[id]`.
- Trang chi tiết phiếu yêu cầu `/requisitions/[id]` render khối "Vật tư hỏng liên quan" (ảnh chứng cứ) khi `requisition_type = replacement`.
- `repairs`: `repair_orders` (SC) + `repair_order_items`; `send_to_repair` (manager; Kho hỏng → Kho đang sửa, HONG staging → in_repair, audit), `complete_repair` (outcome returned_to_stock → Kho chính / liquidation → Kho hỏng), `cancel_repair`. Màn `/repairs` (manager) + `/repairs/[id]?` — không có, chỉ list.
- `defect-actions.tsx`: staging → nút "Đưa đi sửa" (dialog vendor/ngày, gọi `sendToRepair`) + "Hủy"; chỉ manager thao tác được qua RPC.
- RLS: `defect_notes` select = owner hoặc manager. `stock_movements`, `repair_orders`, `liquidation_notes`, `audit_logs` chỉ manager đọc.
- Mã phiếu: `next_code(prefix, seq)`; prefix đã dùng: REQ, GRN, HONG, SC, TL, KK, PXK. Sequence mới cần cho DM.
- `MOVEMENT_TYPE`: có `requisition_out`, `defect_out`, `repair_out`, `repair_return_in`, `liquidation_out`, ... chưa có `exchange_out`.

## 3. Luồng nghiệp vụ

### 3.1 Hướng Đổi Mới (DM)
1. HONG `staging`, đủ chứng cứ (≥1 ảnh/dòng + mô tả), **chưa có phiếu DM sống** và **chưa đề nghị sửa** → owner hoặc manager bấm **"Tạo phiếu đổi mới"** (nhãn nút cố định; không còn chữ "yêu cầu" để khỏi lẫn với module Phiếu yêu cầu).
2. Tạo `exchange_notes` trạng thái `pending`, mã `DM-xxxx`, items copy từ HONG `(variant_id, quantity)`, `linked_defect_id` = HONG, `created_by` = người bấm. Audit `exchange.create`.
3. Manager (từ toggle "Phiếu đổi mới" trên `/defects` hoặc link trực tiếp) mở `/defects/exchange/[id]`:
   - `pending` → **Duyệt** (`approved`) hoặc **Từ chối** (bắt buộc lý do, `rejected`).
   - `approved` → **Cấp phát** (`issued`): trừ Kho chính theo từng item (bung composite), ledger `exchange_out`, ref `exchange`.
   - `issued` → **Xác nhận nhận** (`received`) — manager thao tác giúp người lập HONG.
   - `pending` → owner/manager có thể **Huỷ** (`cancelled`).
4. Đồ hỏng trong HONG **giữ nguyên Kho hỏng** — manager tự xử lý sau (sửa / thanh lý). HONG không đổi trạng thái khi tạo DM.
5. Chip trên dòng HONG hiển thị trạng thái DM liên kết; nút tạo bị ẩn khi đã có DM sống hoặc đã đề nghị sửa.

### 3.2 Hướng Sửa chữa (SC)
1. HONG `staging`, **chưa có DM sống** → **người lập HONG** bấm **"Đề nghị sửa"** → HONG gắn cờ `repair_requested_by/at`, audit `defect.repair_request`, thông báo manager. (Manager không cần đề nghị — có thể xử lý trực tiếp như bước 2.)
2. Manager thấy HONG có cờ "chờ xác nhận sửa" → mở dialog **"Đưa đi sửa / Xác nhận sửa"** (đơn vị sửa, ngày gửi, hẹn về) → gọi `send_to_repair` (sẵn có): tạo SC, Kho hỏng → Kho đang sửa, HONG → `in_repair`, **xoá cờ đề nghị**. Manager cũng có thể "Đưa đi sửa" trực tiếp khi chưa có đề nghị (hành vi hiện tại giữ nguyên). Người lập HONG có thể huỷ đề nghị của mình khi HONG còn `staging`.
3. Hoàn tất sửa tiếp tục qua `/repairs` như hiện tại (`complete_repair`, `cancel_repair`).

### 3.3 Gate chung (1 HONG = 1 hướng tại 1 thời điểm)
- Tạo DM: chặn khi HONG không `staging`, chưa đủ ảnh/mô tả từng dòng, đã có DM sống, hoặc **đang có cờ đề nghị sửa**.
- Đề nghị sửa: chặn khi HONG không `staging`, đã có cờ đề nghị, hoặc đã có DM sống.
- Sau `rejected`/`cancelled` của DM, hoặc huỷ đề nghị sửa → tạo lại được hướng tương ứng.

## 4. Thay đổi chi tiết

### 4.1 DB — migration `0046_exchange_notes.sql`

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

-- Chống trùng: 1 HONG chỉ 1 phiếu DM đang sống (rejected/cancelled → tạo lại được)
create unique index exchange_notes_active_unique
  on public.exchange_notes (linked_defect_id)
  where status in ('pending','approved','issued','received');

alter table public.exchange_notes enable row level security;
alter table public.exchange_note_items enable row level security;

-- SELECT: manager, hoặc người lập HONG liên kết (để xem chip trạng thái trên HONG).
-- INSERT/UPDATE/DELETE: KHÔNG có policy — chỉ qua RPC security definer.
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

> Không đổi bảng requisitions; không đổi enum `requisition_type` (dữ liệu cũ vẫn đọc được). Bắt buộc chứng cứ nằm ở tầng action/RPC gate, không ràng cứng DB để không phá dữ liệu cũ.

### 4.2 DB — migration `0047_exchange_rpc.sql`

- Thêm giá trị enum: `alter type public.movement_type add value if not exists 'exchange_out';`
- `create_exchange(p_defect_id uuid, p_by uuid) returns uuid`:
  - Gate: `auth.uid()`; HONG tồn tại + `status='staging'`; người gọi = `reported_by` hoặc manager; mỗi dòng HONG có `damage_detail` + ≥1 ảnh; **chưa có** DM sống cho HONG (bắt lỗi 23505 của unique index → báo "đã có phiếu Đổi Mới"); **cờ `repair_requested_at` null**.
  - Insert `exchange_notes` code `next_code('DM','public.exchange_notes_seq')`, chép items `(variant_id, quantity)` từ HONG; audit `exchange.create` (before none, after `{status:'pending', defect:'<HONG code>'}`).
- `approve_exchange(p_id, p_by)` — manager; `pending → approved`; audit.
- `reject_exchange(p_id, p_by, p_reason)` — manager; `pending → rejected`; bắt buộc lý do; audit.
- `issue_exchange(p_id, p_by)` — manager; `approved → issued`: build jsonb items từ `exchange_note_items` → `_expand_variant_demand` (bung composite, hàm sẵn có 0036) → `_move_stock(variant, KHO_CHINH, null, qty, 'exchange_out', 'exchange', p_id, p_by)` theo `variant_id` (chống deadlock); audit.
- `receive_exchange(p_id, p_by)` — manager; `issued → received`; audit.
- `cancel_exchange(p_id, p_by)` — manager hoặc người lập HONG liên kết; `pending → cancelled`; audit.
- Mọi RPC theo pattern: `security definer`, `set search_path = public`, `select ... for update`, raise tiếng Việt, ghi `audit_logs` before/after.

### 4.3 DB — migration `0048_repair_request.sql`

```sql
alter table public.defect_notes
  add column repair_requested_by uuid references public.profiles(id),
  add column repair_requested_at timestamptz;
```

- `request_repair(p_id uuid, p_by uuid)` — owner hoặc manager; gate HONG `staging`, chưa có DM sống, `repair_requested_at` null → set cờ + audit `defect.repair_request`.
- `cancel_repair_request(p_id uuid, p_by uuid)` — owner hoặc manager; HONG còn `staging` → xoá cờ + audit.
- Sửa `send_to_repair` (create or replace, giữ signature/logic): sau khi chuyển stock + `in_repair`, **xoá cờ đề nghị** (`repair_requested_at/by = null`) cho các HONG vừa đưa đi sửa. (Xoá cờ chỉ ở nơi duy nhất chuyển trạng thái thật — tránh mồ côi cờ.)
- (Không sửa `complete_repair`/`cancel_repair`.)

### 4.4 Regen types
`bunx supabase gen types typescript --local > src/types/database.types.ts`

### 4.5 Labels
`src/lib/labels.ts`: thêm
```ts
export const EXCHANGE_STATUS: Record<string,string> = {
  pending:"Đang chờ", approved:"Đã duyệt", issued:"Đã cấp phát",
  received:"Đã nhận", rejected:"Từ chối", cancelled:"Đã hủy",
};
// MOVEMENT_TYPE thêm:
exchange_out: "Cấp đổi mới",
```
Badge variant tái dùng `STATUS_BADGE_VARIANTS` sẵn có (các key đã tồn tại).

### 4.6 Feature `src/features/exchanges/`
- `actions.ts` ("use server"): `createExchange(noteId)` — gate giống `create_exchange` qua action (schema không cần; gọi RPC), trả về `{ id, code }` hoặc id để redirect; `approveExchange/rejectExchange/issueExchange/receiveExchange/cancelExchange` gọi RPC tương ứng; notify manager (khi tạo) / người lập HONG (khi duyệt→cấp→nhận) theo pattern `safeNotify` của requisitions; `revalidatePath('/defects')` (+ `/products` khi issue).
- `components/exchange-request-button.tsx` — chuyển từ `features/defects/components/`, đổi: gọi `createExchange`, toast "Đã tạo phiếu Đổi Mới DM-xxxx"; nếu viewer là manager → `router.push('/defects/exchange/<id>')`, ngược lại chỉ refresh trang HONG.
- `components/exchange-manager-tab.tsx` — bảng phiếu DM cho manager: mã DM, HONG liên kết, người lập HONG, ngày, trạng thái, link "Mở" → `/defects/exchange/[id]`; dùng trong toggle của `/defects`.
- `components/exchange-detail-actions.tsx` — theo trạng thái: Duyệt / Từ chối (dialog lý do) / Cấp phát / Xác nhận nhận / Huỷ; gọi actions; `router.refresh()`.

### 4.7 Trang chi tiết `/defects/exchange/[id]/page.tsx` (manager)
- `requireManager()` (hoặc redirect nếu không phải manager — superuser vẫn vào được qua `isPrivileged`).
- Load `exchange_notes` + items (variants/products/attributes/unit) + HONG liên kết + ảnh chứng cứ (`appAssetUrl`) + các actor (created/approved/issued/received/rejected by).
- Render: header (mã DM + badge trạng thái, mã HONG, người lập, ngày), thẻ Vật tư, thẻ "Vật tư hỏng liên quan" (dòng + mô tả + ảnh), tiến trình các mốc (từ cột `*_at`), nhóm nút `ExchangeDetailActions`.
- Không hiển thị cho người lập HONG thường — họ chỉ xem chip trên HONG.

### 4.8 Trang `/defects` — toggle manager + chip trạng thái
- Query thay đổi: thay vì đếm active requisitions để ẩn nút, đọc `exchange_notes` (id, code, status) theo `linked_defect_id in noteIds` (RLS cho phép owner thấy) + cột `repair_requested_at` của HONG.
- Mỗi dòng HONG: nếu có DM sống → chip "Đổi mới: <trạng thái>" + ẩn nút tạo; nếu cờ đề nghị sửa → chip "Chờ xác nhận sửa".
- Toggle (chỉ manager, dùng searchParams `view=exchange` hoặc state client): chế độ "Phiếu hỏng" (mặc định) / "Phiếu đổi mới" (`ExchangeManagerTab`).

### 4.9 Đề nghị sửa trên HONG
- `src/features/defects/actions.ts`: thêm `requestRepair(noteId)` (chỉ owner) + `cancelRepairRequest(noteId)` (owner/manager); revalidate `/defects`; notify manager khi có đề nghị.
- `src/features/defects/components/defect-actions.tsx` (sửa để nhận thêm props `isOwner`, `repairRequested`):
  - Với staging và `isOwner` (hoặc manager đang xem giúp): nút **"Đề nghị sửa"** (gọi `requestRepair`); nếu đã có cờ → chip "Chờ xác nhận sửa" + nút "Hủy đề nghị" (owner/manager).
  - Nút **"Đưa đi sửa"** (manager, dialog vendor/ngày — bước XÁC NHẬN) giữ nguyên cho manager; khi có cờ đề nghị thì đổi nhãn thành **"Xác nhận sửa"** và hiện thông tin ai đề nghị.
- `src/app/(app)/defects/page.tsx` truyền xuống: `isOwner` (`profile.id === d.reported_by`), `repairRequested` (từ cột `repair_requested_at`), `canManage` (manager).

### 4.10 Chặn tạo mới replacement trong phiếu yêu cầu
- `src/features/requisitions/schema.ts`: bỏ `requisitionType`, `linkedDefectId` (+ superRefine); `RequisitionInput` chỉ còn `zoneId/purpose/requesterId/items`.
- `src/features/requisitions/actions.ts`: gọi RPC `create_requisition` với `p_type: 'new_supply'`, `p_linked_defect_id: null`.
- `src/features/requisitions/components/requisition-form.tsx`: bỏ state `type`/`defectId`, ô "Loại phiếu", ô "Phiếu hỏng liên quan", prop `defects`.
- `src/app/(app)/requisitions/new/page.tsx`: bỏ load `defects` + prop.
- `src/app/(app)/requisitions/page.tsx`: bỏ filter "Loại phiếu" (`type`), `TYPES`, `REQUISITION_TYPE` filter UI; giữ `REQUISITION_TYPE` trong labels để đọc dữ liệu cũ.
- Giữ nguyên: trang chi tiết phiếu yêu cầu hiển thị khối chứng cứ HONG khi gặp dữ liệu legacy `replacement` (không xoá code).

### 4.11 Xoá file cũ
- Xoá `src/features/defects/exchange-action.ts` (logic chuyển sang `features/exchanges/actions.ts` + RPC).
- `exchange-request-button.tsx` chuyển chỗ (xem 4.6).

## 5. Kiểm thử

- Script verify (pattern `scripts/verify-*.ts`, chạy local):
  - HONG đủ ảnh → `create_exchange` → DM pending đúng code/items/linked; manager duyệt → cấp (kiểm stock Kho chính giảm + ledger `exchange_out`) → nhận.
  - HONG thiếu ảnh / không `staging` / đã có DM sống / đang đề nghị sửa → tạo DM bị chặn.
  - `request_repair` → cờ set; `send_to_repair` → SC + cờ xoá + stock Kho hỏng → Kho đang sửa; `cancel_repair_request` khi staging → cờ xoá.
  - RLS: requester chỉ select được DM của HONG mình; không insert/update trực tiếp.
- `bunx supabase db reset` + `gen types`.
- `bun run lint` · `bun run typecheck` · `bun run test`.
- QA thủ công browser (2 vai): tạo DM từ HONG, toggle manager, chi tiết DM, đề nghị sửa → xác nhận → `/repairs`; kiểm chip trạng thái trên dòng HONG.

## 6. Loại trừ / không làm
- PDF phiếu Đổi Mới (chưa yêu cầu; có thể thêm sau).
- Migrate phiếu `replacement` cũ → bỏ qua, để nguyên hiển thị.
- Khách hàng trả hàng / đổi trả ngoài luồng bán hàng (issues/customers).
- Cho sửa HONG sau khi lập (giữ quy tắc staging chỉ huỷ).
- Đổi luồng `repairs`/`liquidations` ngoài phần xoá cờ đề nghị trong `send_to_repair`.
- Không tự xoá/đóng stock hỏng khi đổi mới.

## 7. Câu hỏi mở (đặt mặc định, người dùng có thể đổi khi rà spec)
- Tên hiển thị: **"Phiếu Đổi Mới"**, mã **DM**. (Người dùng gọi "đổi trả đồ hỏng" — nếu muốn đổi nhãn UI sang "Đổi trả" thì đổi ở labels, không đổi DB.)
- Ai bấm "Xác nhận nhận" của DM: **manager** (người lập HONG không mở trang này). Nếu sau này muốn người lập HONG tự nhận, thêm quyền `receive` cho owner + nút trên HONG.
- Notification: gửi cho manager khi tạo DM / đề nghị sửa; gửi cho người lập HONG khi DM được duyệt/cấp/nhận (có thể tắt nếu ồn).
