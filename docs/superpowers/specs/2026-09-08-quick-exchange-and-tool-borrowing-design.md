# Đặc tả: Phân hệ Đổi mới 1-1 Cấp tốc & Mượn/Trả Dụng cụ Chuồng Trại

Ngày: 2026-09-08 · Trạng thái: Chờ duyệt · Phạm vi: repo `minh-tan-phat-supply`

---

## 1. Bối cảnh & Mục tiêu

Tại Trại gà Minh Tân Phát, bên cạnh các vật tư tiêu hao thông thường (cám, thuốc, vôi...), vận hành chuồng trại có 2 nhu cầu đặc thù cấp bách:

1. **Đổi mới 1-1 cấp tốc khi thiết bị chuồng gặp sự cố:**
   - Các thiết bị điện nước chuồng kín (quạt hút thông gió, bóng sưởi úm gà con, rơ le nhiệt, van nước tự động) khi hỏng hóc có thể gây ngạt hoặc chết gà chỉ trong 30-60 phút.
   - Nhân viên tại chuồng cần một luồng 1 chạm: Chụp ảnh hiện trường $\rightarrow$ Nhập lý do hỏng $\rightarrow$ Tự động sinh phiếu đổi mới và duyệt thẳng để thủ kho xuất đồ mới cứu chuồng ngay lập tức mà không phải chờ duyệt qua nhiều cấp.

2. **Quản lý Mượn & Trả dụng cụ dùng chung:**
   - Trại có các công cụ, máy móc giá trị cao dùng chung giữa các chuồng: máy hàn cơ, máy rửa áp lực cao, máy cắt sắt cầm tay, thang nhôm chữ A, kìm bấm thẻ cánh gà, máy đo nhiệt độ độ ẩm...
   - Hiện tại hệ thống đang xuất kho theo dạng tiêu hao (Requisition), dẫn đến khó theo dõi công nhân nào/khu chuồng nào đang giữ máy gì, hay bị thất lạc hoặc quên không trả về kho.
   - Cần một phân hệ Mượn/Trả dụng cụ chuyên biệt (`/tools`) để quản lý tồn kho khả dụng, theo dõi danh sách *"Dụng cụ tôi đang giữ"*, cảnh báo quá hạn trả, và hỗ trợ trả từng phần.

---

## 2. Thiết kế Cơ sở Dữ liệu (Database Schema)

### 2.1. Enum & Sequence Mượn Dụng Cụ
```sql
create type public.tool_borrowing_status as enum (
  'borrowed',   -- Đang mượn
  'returned',   -- Đã trả đủ
  'cancelled'   -- Đã hủy phiếu
);

create sequence public.tool_borrowings_seq;
```

### 2.2. Bảng `tool_borrowings` (Phiếu Mượn Dụng Cụ)
```sql
create table public.tool_borrowings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                  -- VD: 'MDC-20260908-0001' (Mượn Dụng Cụ)
  borrower_id uuid not null references public.profiles(id), -- Người mượn
  zone_id uuid references public.zones(id),   -- Khu vực chuồng sử dụng
  purpose text not null,                      -- Mục đích sử dụng (vd: 'Hàn khung quạt chuồng 3')
  borrowed_at timestamptz not null default now(), -- Ngày giờ mượn
  expected_return_date date,                  -- Ngày hẹn trả (để tính cờ quá hạn)
  returned_at timestamptz,                    -- Ngày giờ hoàn tất trả đủ
  issued_by uuid references public.profiles(id), -- Thủ kho giao dụng cụ
  received_back_by uuid references public.profiles(id), -- Thủ kho nhận lại
  notes text,
  status public.tool_borrowing_status not null default 'borrowed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tool_borrowings_borrower_idx on public.tool_borrowings(borrower_id);
create index tool_borrowings_status_idx on public.tool_borrowings(status);
```

### 2.3. Bảng `tool_borrowing_items` (Chi tiết Dụng Cụ Mượn)
```sql
create table public.tool_borrowing_items (
  id uuid primary key default gen_random_uuid(),
  borrowing_id uuid not null references public.tool_borrowings(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity int not null check (quantity > 0),             -- Số lượng mượn
  returned_quantity int not null default 0 check (returned_quantity >= 0), -- Số lượng đã trả
  notes text
);

create index tool_borrowing_items_borrowing_idx on public.tool_borrowing_items(borrowing_id);
```

### 2.4. Bổ sung Ledger Movement Types
```sql
alter type public.movement_type add value if not exists 'tool_borrow_out';
alter type public.movement_type add value if not exists 'tool_return_in';
```

---

## 3. Các hàm RPC Nghiệp vụ (Transaction & Security Definer)

### 3.1. `quick_emergency_exchange` (Đổi mới 1-1 cấp tốc)
```sql
create or replace function public.quick_emergency_exchange(
  p_variant_id uuid,
  p_quantity int,
  p_damage_detail text,
  p_images text[],
  p_zone_id uuid,
  p_by uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_defect_id uuid;
  v_exchange_id uuid;
  v_defect_code text;
  v_exchange_code text;
  v_main_loc uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_quantity <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  if p_images is null or array_length(p_images, 1) is null or array_length(p_images, 1) = 0 then
    raise exception 'Bắt buộc phải có ít nhất 1 ảnh hiện trường hỏng';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';

  -- 1. Tạo phiếu báo hỏng ở trạng thái staging
  v_defect_code := public.next_code('HONG', 'public.defect_notes_seq'::regclass);
  insert into public.defect_notes (code, source_location_id, reported_by, status)
  values (v_defect_code, v_main_loc, p_by, 'staging')
  returning id into v_defect_id;

  insert into public.defect_note_items (defect_note_id, variant_id, quantity, damage_detail, images, note)
  values (v_defect_id, p_variant_id, p_quantity, p_damage_detail, p_images, 'Đổi mới khẩn cấp 1-1');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.create', 'defect', v_defect_id, jsonb_build_object('status', 'staging', 'emergency', true));

  -- 2. Tạo phiếu Đổi Mới và duyệt thẳng (approved)
  v_exchange_code := public.next_code('DM', 'public.exchange_notes_seq'::regclass);
  insert into public.exchange_notes (code, linked_defect_id, created_by, approved_by, approved_at, status)
  values (v_exchange_code, v_defect_id, p_by, p_by, now(), 'approved')
  returning id into v_exchange_id;

  insert into public.exchange_note_items (exchange_note_id, variant_id, quantity)
  values (v_exchange_id, p_variant_id, p_quantity);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'exchange.create_emergency', 'exchange', v_exchange_id, jsonb_build_object('status', 'approved'));

  return jsonb_build_object(
    'defect_id', v_defect_id,
    'defect_code', v_defect_code,
    'exchange_id', v_exchange_id,
    'exchange_code', v_exchange_code
  );
end;
$$;
```

### 3.2. `create_tool_borrowing` (Tạo phiếu mượn dụng cụ)
* Kiểm tra tồn kho khả dụng tại Kho chính (`KHO_CHINH`).
* Trừ tồn kho và ghi ledger `tool_borrow_out`.
* Tạo phiếu `tool_borrowings` với trạng thái `borrowed`.
* Sinh mã tự động `MDC-YYYYMMDD-XXXX`.

### 3.3. `return_tool_borrowing` (Nhận trả dụng cụ)
* Hỗ trợ trả từng phần hoặc trả toàn bộ.
* Cộng lại tồn kho tại Kho chính và ghi ledger `tool_return_in`.
* Cập nhật `returned_quantity`. Nếu tất cả các dòng đã trả đủ $\ge$ số lượng mượn, cập nhật trạng thái phiếu sang `returned` và lưu `returned_at = now()`.

### 3.4. `cancel_tool_borrowing` (Hủy phiếu mượn)
* Chỉ cho phép hủy khi chưa có dòng nào trả và người gọi là Quản lý kho hoặc người mượn.
* Hoàn trả lại số lượng dụng cụ đã xuất kho.

---

## 4. Thiết kế Giao diện Người dùng (UI / UX)

### 4.1. Luồng Đổi mới 1-1 Cấp tốc
* **Nút bấm:** Nút màu đỏ nổi bật có icon `Zap` *"Đổi khẩn cấp 1-1"* trên `/defects` và chi tiết sản phẩm `/products`.
* **Hộp thoại `QuickExchangeDialog`:**
  * Chọn vật tư (có camera quét QR tem hỏng).
  * Bộ chọn số lượng (mặc định 1).
  * Chụp ảnh hiện trường camera hoặc upload ảnh.
  * Nhập lý do hỏng ngắn gọn.
  * Bấm gửi $\rightarrow$ Bắn thông báo khẩn cấp tới Quản lý kho, điều hướng tới chi tiết phiếu đổi mới `/defects/exchange/[id]`.

### 4.2. Phân hệ Quản lý Mượn & Trả Dụng Cụ (`/tools`)
* **Menu điều hướng:** Thêm mục **"Dụng cụ"** (`/tools`) với icon `Wrench` trên Main Navigation.
* **Màn hình phía Nhân viên chuồng (Requester):**
  * **Tab "Dụng cụ tôi đang giữ":**
    * Các thẻ dụng cụ trực quan: Tên dụng cụ, Số lượng đang cầm, Ngày mượn, Ngày hẹn trả.
    * Badge cảnh báo: Xanh (Còn hạn) / Đỏ nhấp nháy (Quá hạn).
    * Nút bấm: **"Báo trả dụng cụ"** (mở hộp thoại nhập số lượng trả).
  * **Tab "Lịch sử mượn trả":** Lịch sử các lần mượn trước đây.
  * **Nút "Mượn dụng cụ" (`ToolBorrowDialog`):** Chọn dụng cụ từ kho, chọn ngày hẹn trả, nhập mục đích.
* **Màn hình phía Quản lý Kho (Manager):**
  * **Tab "Đang cho mượn":** Danh sách toàn trại ai đang mượn máy móc gì, lọc theo chuồng hoặc quá hạn.
  * **Nút thao tác "Nhận lại đồ" (`ToolReturnDialog`):** Thủ kho kiểm đếm, nhập số lượng nhận lại và xác nhận để hoàn kho.
  * **In phiếu mượn:** Hỗ trợ xem và in PDF phiếu mượn theo chuẩn `StandardSlip`.

---

## 5. Kế hoạch Kiểm thử & Nghiệm thu (Acceptance Criteria)

### 5.1. Đổi mới 1-1 cấp tốc
- [ ] Bấm nút "Đổi khẩn cấp 1-1", quét QR / chọn vật tư và chụp 1 ảnh hỏng.
- [ ] Gửi thành công: Tự động sinh phiếu `HONG-xxx` (staging) và phiếu `DM-xxx` ở trạng thái `approved`.
- [ ] Thủ kho thấy phiếu đổi mới trong danh sách chờ cấp phát và bấm Cấp phát thành công.
- [ ] Người yêu cầu thấy phiếu đổi mới và bấm Xác nhận đã nhận thành công.

### 5.2. Mượn & Trả dụng cụ
- [ ] Tạo phiếu mượn dụng cụ: Tồn kho của dụng cụ tại Kho chính tự động giảm, ledger ghi `tool_borrow_out`.
- [ ] Nhân viên mở tab "Dụng cụ tôi đang giữ" thấy đúng số lượng và ngày hẹn trả.
- [ ] Khi quá hạn trả, thẻ dụng cụ hiển thị cảnh báo quá hạn.
- [ ] Trả dụng cụ: Thủ kho bấm nhận lại $\rightarrow$ Tồn kho tại Kho chính tự động tăng lại, ledger ghi `tool_return_in`.
- [ ] Trả từng phần (mượn 2 trả 1) $\rightarrow$ số lượng còn lại cập nhật chính xác, trạng thái vẫn là `borrowed`; khi trả nốt món còn lại $\rightarrow$ chuyển sang `returned`.
