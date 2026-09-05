# Lịch sử trả lại vật tư trong phiếu yêu cầu — Design

- Ngày: 2026-09-05
- Trạng thái: Thiết kế đã được người dùng duyệt (2026-09-05)
- Phạm vi: feature `requisitions` — ghi + hiển thị lịch sử trả lại vật tư

## 1. Bối cảnh & mục tiêu

Phiếu yêu cầu đã có luồng **trả lại vật tư không dùng hết**: sau khi cấp phát (`issued`) hoặc nhận hàng (`received`), người yêu cầu (owner) hoặc manager nhập số lượng trả cho từng vật tư → RPC `return_requisition_items` chuyển stock về Kho chính (`return_in`) và ghi 1 dòng `audit_logs`.

Vấn đề hiện tại:
1. **Không có lịch sử trả lại có cấu trúc** — chỉ có 1 dòng audit_logs dạng `after.items` (jsonb), không tra cứu/liệt kê tiện.
2. **Người yêu cầu không xem được lịch sử** — RLS `audit_logs_select` chỉ cho manager (`using (public.is_manager())`).
3. Form trả (`ReturnItems`) không biết **đã trả bao nhiêu rồi** — ô nhập cap theo "đã cấp" thay vì "còn có thể trả" (`đã cấp − đã trả`), và không hiển thị số đã trả trên từng dòng.

Mục tiêu (đã chốt với người dùng):
1. Mỗi lần bấm "Trả lại kho" = **1 sự kiện lịch sử** (ngày giờ, người trả, từng dòng vật tư + số lượng).
2. Lịch sử hiển thị cho **cả người yêu cầu (owner) và manager**.
3. Hiển thị ở **card "Lịch sử trả lại" riêng** trên trang chi tiết phiếu + **số đã trả trên từng dòng vật tư**.
4. Không cần ô lý do/ghi chú khi trả (giữ gọn).

## 2. Hiện trạng liên quan (đã rà)

- `public.requisition_items`: `(id, requisition_id → requisitions, variant_id → variants, quantity)`.
- RPC `return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid)` — bản đang chạy (0023):
  - Gate: `auth.uid()` đã đăng nhập; người gọi = `requester_id` của phiếu hoặc manager; phiếu ở `issued | received`.
  - Mỗi item `{variant_id, quantity}`: kiểm tra `quantity <= issued − returned` (returned đếm từ `stock_movements` `return_in` của phiếu), rồi `_move_stock(variant, null, KHO_CHINH, qty, 'return_in', 'requisition', p_requisition_id, p_by)`.
  - Cuối: `insert audit_logs (actor_id = auth.uid(), 'requisition.return', after = {items})`.
- `stock_movements`: ledger đầy đủ từng lần `return_in` nhưng **RLS select chỉ manager** → requester không đọc được để dựng lịch sử.
- RLS `requisition_items_select`: manager hoặc owner của phiếu (`exists requisitions r where r.id = requisition_id and r.requester_id = auth.uid()`).
- Trang chi tiết `src/app/(app)/requisitions/[id]/page.tsx`: card "Trả lại vật tư không dùng hết" render khi `issued | received` và viewer là manager/owner; `ReturnItems` nhận `items {id, variantId, label, quantity}`.
- `src/features/requisitions/actions.ts`: `returnRequisitionItems` gọi RPC, `revalidatePath('/requisitions/${id}')` + `/products`, notify các manager.
- Timeline: manager đọc `audit_logs` (có mốc "Trả lại vật tư"); requester chỉ thấy các mốc cơ bản (không có mốc trả lại).

## 3. Luồng nghiệp vụ

1. Phiếu ở `issued | received`, người xem là owner hoặc manager → thấy card "Trả lại vật tư không dùng hết". Mỗi dòng hiển thị `đã cấp X · đã trả Y`, ô nhập số trả giới hạn **≤ X − Y**, disable khi `X − Y = 0`.
2. Nhập số lượng (1 hoặc nhiều dòng) → "Trả lại kho":
   - RPC giữ nguyên các gate + chuyển stock về Kho chính + ghi `stock_movements` (`return_in`) + `audit_logs`.
   - **Mới**: RPC ghi thêm header `requisition_returns` (requisition_id, returned_by = auth.uid()) + từng dòng `requisition_return_items` (variant_id, quantity) trong cùng transaction.
3. Trang chi tiết sau khi refresh hiển thị card **"Lịch sử trả lại"**: từng sự kiện (người trả, thời gian, tổng số dòng/số lượng) kèm chi tiết các dòng (tên vật tư, biến thể, đơn vị, số lượng) — cả manager lẫn requester đều đọc được.
4. Trên mỗi dòng vật tư của phiếu (danh sách "Vật tư") hiển thị thêm `đã trả Y` khi Y > 0.

## 4. Thay đổi chi tiết

### 4.1 DB — migration mới `0032_requisition_returns.sql`

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
```

- Chỉ SELECT qua RLS; INSERT/UPDATE/DELETE chỉ qua RPC security definer (mặc định deny trực tiếp — khớp nguyên tắc: mọi thay đổi stock qua RPC).
- Ghi chú: chỉ `for select`; không thêm policy insert để tránh user tự thêm lịch sử giả.

### 4.2 RPC `return_requisition_items` — ghi header + dòng lịch sử

Sửa trong migration mới (create or replace). Giữ nguyên signature `(p_requisition_id uuid, p_items jsonb, p_by uuid)`. Logic mới:

- Trước vòng lặp: `insert into public.requisition_returns (requisition_id, returned_by) values (p_requisition_id, auth.uid()) returning id into v_return_id;`
- Trong vòng lặp, sau mỗi lần `_move_stock` thành công: `insert into public.requisition_return_items (return_id, variant_id, quantity) values (v_return_id, variant_id, quantity);`
- Giữ nguyên check tồn (`stock_movements` vẫn là nguồn tính `returned`), audit_logs vẫn ghi như cũ.
- Toàn bộ trong 1 function = 1 transaction → nếu 1 dòng lỗi giữa chừng, không để lại header/dòng mồ côi.

### 4.3 Regen types

`bunx supabase gen types typescript --local > src/types/database.types.ts`

### 4.4 Trang chi tiết phiếu — truy vấn lịch sử + truyền số đã trả

`src/app/(app)/requisitions/[id]/page.tsx`:
- Truy vấn: `requisition_returns` với `returned_by:profiles!requisition_returns_returned_by_fkey(name)` + `items:requisition_return_items(variant_id, quantity, variants(attributes, unit, products(name, images)))`, order `created_at desc`.
- Tính `returnedByVariant: Map<variant_id, number>` (tổng từng variant qua các sự kiện) để:
  - Truyền vào `ReturnItems` (mỗi dòng biết đã trả bao nhiêu → cap ô nhập = issued − returned).
  - Truyền vào danh sách vật tư (MaterialItemsView) để hiện `đã trả Y` khi Y > 0.
- Render card **"Lịch sử trả lại"** khi có sự kiện: mỗi sự kiện hiện người trả + thời gian (`formatDate`) + bảng/liệt kê từng dòng (tên vật tư, biến thể, đơn vị, số lượng).

### 4.5 Form trả `return-items.tsx`

- Nhận thêm `returnedByVariant` (hoặc mỗi item kèm `returned`).
- Mỗi dòng: label + `đã cấp X · đã trả Y`; input `max = X − Y` (tối thiểu 0), placeholder "Số trả"; disable khi còn 0.
- Sau thành công: `router.refresh()` để card lịch sử + số đã trả cập nhật (action đã revalidate).

### 4.6 Action + notify

`returnRequisitionItems` (actions.ts): giữ nguyên revalidate; đã notify manager. Không đổi hành vi notify trong đợt này (không thêm ô lý do).

### 4.7 Verify script

`scripts/verify-return-history.ts` (theo pattern `verify-requisition-flow.ts`):
- Requester + manager sign-in local; tạo phiếu đủ hành trình → `issued`; trả 1 phần → kiểm:
  - `stock_movements` có dòng `return_in` đúng số lượng;
  - `requisition_returns` có 1 header; `requisition_return_items` đủ dòng/đúng số lượng;
  - requester (owner) `select` được lịch sử; trả vượt bị reject.

## 5. Loại trừ / không làm

- Không thêm ô **lý do/ghi chú** khi trả.
- Không tự đổi trạng thái phiếu khi trả (phiếu vẫn `issued | received` như hiện tại).
- Không backfill lịch sử cũ từ `stock_movements` (dữ liệu seed hiện chưa có lần trả nào; luồng mới ghi từ nay).
- Không sửa PDF, không sửa timeline manager (audit vẫn có mốc "Trả lại vật tư").
- Không thay đổi RLS `audit_logs` / `stock_movements`.
