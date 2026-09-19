# Hệ thống Quản trị Vật tư Đa cấp & Quy đổi Đơn vị Tính (Multi-level Unit Conversion & Packaging System) — Design Spec

**Dự án:** Minh Tân Phát Supply & Farm ERP  
**Đơn vị áp dụng:** Trại gà đẻ trứng Minh Tân Phát (Ấp Tân Tiến, Xã Minh Tân, Huyện Dầu Tiếng, Tỉnh Bình Dương)  
**Tác giả:** Antigravity Team  
**Ngày lập:** 09/09/2026  
**Trạng thái:** Approved / Implementation Ready  

---

## 1. TỔNG QUAN HỆ THỐNG & BỐI CẢNH VẬN HÀNH THỰC TẾ

### 1.1. Bối cảnh Vận hành tại Trại Gà Minh Tân Phát
Trại gà Minh Tân Phát vận hành theo mô hình trại kín quy mô công nghiệp với hàng trăm nghìn cá thể gà đẻ trứng. Công tác hậu cần kho vận tại trại bao gồm quản lý hàng nghìn danh mục vật tư tiêu hao, hóa chất sát trùng, thuốc thú y, thức ăn cám và linh phụ kiện sửa chữa trang trại.

Trong thực tế, **đơn vị mua hàng/nhập kho từ nhà cung cấp** và **đơn vị sử dụng/xuất kho thực tế tại từng dãy trại** thường xuyên không đồng nhất:
1. **Keo dán bạt trại kín:** Nhập từ nhà phân phối theo **Thùng** (1 Thùng = 6 Hộp keo chuyên dụng 550ml).
   - Khi kỹ thuật đại tu thay bạt toàn bộ dãy trại 1: Cần xin **2 Thùng**.
   - Khi công nhân đi kiểm tra định kỳ phát hiện 1 vết rách nhỏ cần dặm vá: Chỉ cần xin **1 Hộp** (550ml).
2. **Thuốc sát trùng / Hóa chất diệt khuẩn trại (Iodine, Formol, Glutaraldehyde):**
   - Nhập từ công ty thú y theo **Can** 5 Lít hoặc **Phuy** 200 Lít.
   - Khi phun sát trùng cổng trại và hố sát trùng: Cấp **1 Can** (5.000 ml).
   - Khi pha bình phun thuốc diệt mạt gà định kỳ ô trại: Cấp **500 ml** hoặc **1.000 ml**.
3. **Cám thức ăn hỗn hợp & Vôi bột xử lý nền:**
   - Nhập theo **Tấn** (1 Tấn = 40 Bao = 1.000 Kg) hoặc **Bao 25kg**.
   - Trại nhỏ hoặc khu vực úm gà cần cấp lẻ **2 Bao** hoặc **50 Kg**.
4. **Dây kẽm bọc nhựa buộc trại & Lưới thép:**
   - Nhập theo **Cuộn** (1 Cuộn = 100 Mét).
   - Cấp phát sửa lồng gà theo **Mét** (VD: xin 15 Mét).
5. **Thuốc thú y dạng vỉ/viên/gói (Thuốc bổ trợ đẻ trứng, men tiêu hóa, kháng sinh):**
   - Nhập theo **Thùng** (1 Thùng = 10 Hộp = 100 Vỉ = 1.000 Viên/Gói).
   - Cấp phát theo **Hộp** hoặc **Vỉ**.

---

### 1.2. Vấn đề của Hệ thống Cũ & Mục tiêu Nâng cấp

#### ❌ Bất cập của hệ thống trước đây:
* Khi tạo vật tư mới trong trang Quản trị (/admin/products), hệ thống chỉ hỗ trợ 3 chế độ:
  1. *Lẻ (1 quy cách)*: Bắt buộc chọn 1 đơn vị duy nhất (chỉ chọn được Thùng HOẶC Hộp), không hỗ trợ đơn vị thứ hai.
  2. *Nhiều quy cách*: Mỗi quy cách (10kg, 25kg) là một dòng tồn kho độc lập, không liên thông số lượng tồn vật lý với nhau.
  3. *Bộ lắp ráp*: Giao diện và thuật ngữ hướng cơ khí/BOM (Bộ gồm Linh kiện A ×1 + Linh kiện B ×2), khó hiểu và không phù hợp với nghiệp vụ đóng gói quy đổi.
* **Người xin vật tư tại trại bị gò bó:** Không thể chọn xin theo Thùng hoặc theo Hộp một cách linh hoạt.
* **Tồn kho bị chia cắt hoặc tính toán sai lệch:** Thủ kho phải tự tính nhẩm quy đổi bên ngoài bằng máy tính tay, dễ dẫn đến thất thoát hoặc âm kho.

#### 🎯 Mục tiêu Hệ thống Mới:
1. **Chế độ Tạo vật tư "Quy đổi đơn vị" (Smart Unit Conversion):** Giao diện chuyên biệt cho phép khai báo **Đơn vị cơ sở (Base Unit)** và **Các đơn vị đóng gói quy đổi (Packaging Units)** với tỷ lệ quy đổi số nguyên trực quan.
2. **Linh hoạt Tùy chọn Đơn vị khi Đặt hàng:** Người yêu cầu (ở màn hình Sản phẩm, Chi tiết, Quét QR, Giỏ hàng) có thể chọn đơn vị mong muốn (Thùng hoặc Hộp). Tồn kho khả dụng tự động tính theo đơn vị đang chọn.
3. **Đảm bảo Tính Toàn vẹn Sổ cái (Ledger Single Source of Truth):** Toàn bộ tồn kho vật lý thực tế được quản lý theo Đơn vị cơ sở trong stock_balances. Khi duyệt cấp phát/xuất kho 2 Thùng, hệ thống tự động quy đổi thành 12 Hộp và trừ kho chuẩn xác thông qua RPC PostgreSQL an toàn.
4. **Minh bạch Trên Mọi Chứng từ:** Hiển thị rõ số lượng theo đơn vị yêu cầu kèm chú thích quy đổi chuẩn hóa trên Phiếu yêu cầu (REQ), Phiếu xuất kho (PXK), Phiếu nhập kho (PNK) và Mẫu in PDF chuẩn.

---

## 2. KIẾN TRÚC DỮ LIỆU & QUAN HỆ CƠ SỞ DỮ LIỆU (DATABASE ARCHITECTURE)

### 2.1. Mô hình Quan hệ Thực thể (Entity Relationship)

Tận dụng cấu trúc bảng products, variants, variant_components và stock_balances hiện có của Supabase PostgreSQL mà không cần phá vỡ cấu trúc bảng cũ:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       BẢNG PRODUCTS                                         │
│  id: uuid (PK)                                                                              │
│  name: "Keo dán bạt trang trại"                                                            │
│  category_id: uuid -> categories(id)                                                        │
│  images: text[]                                                                             │
│  options: ["Quy cách"]                                                                      │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               │ 1 Product -> n Variants                                       │
               ▼                                                               ▼
┌──────────────────────────────────────────────┐ ┌──────────────────────────────────────────────┐
│       VARIANT 1: ĐƠN VỊ CƠ SỞ (BASE)         │ │     VARIANT 2: ĐƠN VỊ ĐÓNG GÓI (PACKAGE)     │
│  id: v_base_uuid (PK)                        │ │  id: v_box_uuid (PK)                         │
│  product_id: uuid -> products(id)            │ │  product_id: uuid -> products(id)            │
│  unit: "Hộp"                                 │ │  unit: "Thùng"                               │
│  attributes: {"Quy cách": "550ml"}           │ │  attributes: {"Quy cách": "6 Hộp"}          │
│  price: 85.000                               │ │  price: 480.000                              │
│  min_stock: 10                               │ │  min_stock: 0                                │
│  is_default: false                           │ │  is_default: true                            │
│  is_trackable_lot: false                     │ │  is_trackable_lot: false                     │
└──────────────────────┬───────────────────────┘ └──────────────────────┬───────────────────────┘
                       │                                                │
                       │             ┌────────────────────────┐         │
                       │             │ BẢNG VARIANT_COMPONENTS│         │
                       └────────────►│ child_variant_id       │◄────────┘
                        (Child / ĐVT)│ parent_variant_id      │ (Parent / Đóng gói)
                                     │ quantity = 6           │ (Tỷ lệ quy đổi: 1 Thùng = 6 Hộp)
                                     └────────────────────────┘
                                                │
                                                ▼
                       ┌────────────────────────────────────────────────┐
                       │              BẢNG STOCK_BALANCES               │
                       │  variant_id: v_base_uuid (LƯU TỒN KHO THỰC TẾ) │
                       │  location_id: loc_main_uuid (KHO_CHINH)        │
                       │  quantity: 64 (tổng số Hộp hiện có trong kho)  │
                       └────────────────────────────────────────────────┘
```

---

### 2.2. Chi tiết Cấu trúc Bảng & Khóa ngoại (Schema Definition)

#### 1. Bảng public.variants (Dòng biến thể / Quy cách / Đơn vị)
```sql
create table public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attributes jsonb not null default '{}'::jsonb, -- Lưu quy cách chi tiết (VD: {"Quy cách": "550ml"})
  price numeric(12,2),                           -- Đơn giá xuất/bán theo đơn vị này
  images text[] not null default '{}',
  unit text,                                     -- Tên đơn vị tính: "Hộp", "Thùng", "Bao", "Can", "Lít", "ml"
  min_stock integer not null default 0,          -- Tồn tối thiểu cảnh báo hết hàng
  is_trackable_lot boolean not null default false, -- Theo dõi số lô & HSD
  is_default boolean not null default false,     -- Biến thể mặc định khi mở chi tiết
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_variants_product_id on public.variants(product_id);
```

#### 2. Bảng public.variant_components (Bảng Định mức & Quan hệ Quy đổi Đơn vị)
```sql
create table public.variant_components (
  id uuid primary key default gen_random_uuid(),
  parent_variant_id uuid not null references public.variants(id) on delete cascade, -- Đơn vị đóng gói lớn (Thùng)
  child_variant_id uuid not null references public.variants(id) on delete cascade,  -- Đơn vị cơ sở con (Hộp)
  quantity integer not null default 1 check (quantity >= 1),                        -- Tỷ lệ quy đổi (VD: 6)
  created_at timestamptz not null default now(),
  unique (parent_variant_id, child_variant_id)
);

create index idx_variant_components_parent on public.variant_components(parent_variant_id);
create index idx_variant_components_child on public.variant_components(child_variant_id);
```

#### 3. Bảng public.stock_balances (Số dư Tồn kho Vật lý Thực tế)
```sql
create table public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade, -- Luôn là variant_id của Đơn vị cơ sở
  location_id uuid not null references public.stock_locations(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (variant_id, location_id)
);
```

---

## 3. CÁC THUẬT TOÁN & HÀM RPC NGHIỆP VỤ LÕI (CORE BUSINESS LOGIC & RPC)

### 3.1. Thuật toán Tính Tồn kho Khả dụng Đa cấp (View location_stock)
Hệ thống tính toán số dư tồn kho thời gian thực của mọi biến thể theo công thức:
- **Nếu là Đơn vị cơ sở (không có trong variant_components làm parent):** Lấy trực tiếp số dư từ stock_balances.
- **Nếu là Đơn vị quy đổi đóng gói (có trong variant_components làm parent):** Tính toán bằng hàm chia nguyên sàn (floor division):
  Tồn khả dụng (Thùng) = floor(Tồn kho của Hộp / 6)

```sql
create or replace view public.location_stock
with (security_invoker = true) as
select
  loc.location_id,
  v.id as variant_id,
  v.product_id,
  case
    when exists (select 1 from public.variant_components vc where vc.parent_variant_id = v.id) then coalesce((
      select min(sb.quantity / greatest(vc.quantity, 1))
      from public.variant_components vc
      join public.stock_balances sb
        on sb.variant_id = vc.child_variant_id
       and sb.location_id = loc.location_id
      where vc.parent_variant_id = v.id
    ), 0)
    else coalesce((
      select sb.quantity
      from public.stock_balances sb
      where sb.variant_id = v.id
        and sb.location_id = loc.location_id
    ), 0)
  end as quantity
from public.variants v
cross join (
  select distinct location_id
  from public.stock_balances
) loc;
```

---

### 3.2. Thuật toán Tự động Phân rã Nhu cầu Trừ kho (_effective_demand & _expand_variant_demand)
Khi nhân viên lập Phiếu yêu cầu cấp phát (Requisition) hoặc Phiếu xuất kho (Issue) với số lượng Q theo đơn vị **Thùng**:
Nhu cầu thực tế = Q * Tỷ lệ quy đổi = 2 * 6 = 12 Hộp

```sql
create or replace function public._expand_variant_demand(p_items jsonb)
returns table (variant_id uuid, quantity int)
language sql stable security definer set search_path = public as $$
  select t.variant_id, sum(t.qty)::int as quantity
  from (
    -- Dòng vật tư đơn vị cơ sở: giữ nguyên số lượng
    select (it.value->>'variant_id')::uuid as variant_id, (it.value->>'quantity')::int as qty
    from jsonb_array_elements(p_items) it
    where not exists (
      select 1 from public.variant_components vc
      where vc.parent_variant_id = (it.value->>'variant_id')::uuid
    )
    union all
    -- Dòng vật tư đơn vị quy đổi: nhân với hệ số quy đổi để ra số lượng đơn vị cơ sở
    select vc.child_variant_id, ((it.value->>'quantity')::int) * vc.quantity as qty
    from jsonb_array_elements(p_items) it
    join public.variant_components vc
      on vc.parent_variant_id = (it.value->>'variant_id')::uuid
  ) t group by t.variant_id
$$;
```

---

### 3.3. Hàm Di chuyển Tồn kho & Ghi Sổ cái An toàn (_move_stock)
Mọi thao tác trừ kho đều dùng cơ chế khóa dòng (SELECT ... FOR UPDATE) để chống tranh chấp (race condition) và ghi vết đầy đủ vào stock_movements:

```sql
create or replace function public._move_stock(
  p_variant uuid,
  p_from uuid,
  p_to uuid,
  p_qty int,
  p_mtype public.movement_type,
  p_ref_type text,
  p_ref_id uuid,
  p_by uuid,
  p_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_qty int;
begin
  if p_qty <= 0 then
    raise exception 'Số lượng phải lớn hơn 0';
  end if;

  -- Trừ tồn tại kho xuất
  if p_from is not null then
    select quantity into v_qty from public.stock_balances
    where variant_id = p_variant and location_id = p_from for update;
    if v_qty is null or v_qty < p_qty then
      raise exception 'Không đủ tồn tại kho để xuất (yêu cầu %, hiện có %)', p_qty, coalesce(v_qty, 0);
    end if;
    update public.stock_balances set quantity = quantity - p_qty, updated_at = now()
    where variant_id = p_variant and location_id = p_from;
  end if;

  -- Cộng tồn tại kho nhập
  if p_to is not null then
    insert into public.stock_balances (variant_id, location_id, quantity)
    values (p_variant, p_to, p_qty)
    on conflict (variant_id, location_id)
    do update set quantity = public.stock_balances.quantity + excluded.quantity, updated_at = now();
  end if;

  -- Ghi nhận biến động sổ cái
  insert into public.stock_movements
    (variant_id, from_location_id, to_location_id, movement_type, quantity, ref_type, ref_id, notes, created_by)
  values
    (p_variant, p_from, p_to, p_mtype, p_qty, p_ref_type, p_ref_id, p_notes, p_by);
end;
$$;
```

---

## 4. THIẾT KẾ GIAO DIỆN NGƯỜI DÙNG & TRẢI NGHIỆM (UI / UX DESIGN)

### 4.1. Modal Tạo Vật tư Mới (ProductFormDialog)
Thêm tab **"Quy đổi đơn vị"** (quy-doi) nằm cạnh các chế độ *Lẻ*, *Nhiều quy cách* và *Bộ lắp ráp*:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Tạo vật tư mới                                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Kiểu quản lý vật tư & đơn vị:                                                               │
│ ┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐  │
│ │ ( ) Lẻ (1 quy cách)       │ │ (●) Quy đổi đơn vị        │ │ ( ) Nhiều quy cách        │  │
│ │ 1 dòng tồn kho duy nhất   │ │ VD 1 Thùng = 6 Hộp 550ml  │ │ 10kg, 25kg độc lập        │  │
│ └───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘  │
│                                                                                             │
│ Tên vật tư: [ Keo dán bạt trang trại                                                     ] │
│ Danh mục:   [ Keo & Hóa chất kết dính                                                   ▼ ] │
│ Mô tả:      [ Keo chuyên dụng chống thấm, dán vá bạt che trại kín                       ] │
│                                                                                             │
│ ┌── 1. ĐƠN VỊ CƠ SỞ (Đơn vị nhỏ nhất để quản lý tồn kho) ─────────────────────────────────┐ │
│ │ Tên đơn vị cơ sở: [ Hộp        ]   Quy cách/Thể tích: [ 550ml                         ] │ │
│ │ Giá xuất lẻ:      [ 85.000     ] đ Tồn tối thiểu:     [ 10                            ] │ │
│ │ [ ] Theo dõi theo số lô & hạn sử dụng                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│ ┌── 2. ĐƠN VỊ ĐÓNG GÓI QUY ĐỔI ───────────────────────────────────────────────────────────┐ │
│ │ [ + Thêm cấp đóng gói ]                                                                 │ │
│ │                                                                                         │ │
│ │ • Cấp đóng gói #1:                                                                      │ │
│ │   Tên đơn vị lớn: [ Thùng      ]                                                        │ │
│ │   Tỷ lệ quy đổi:  1 Thùng  =  [  6  ]  x  Hộp (550ml)                                   │ │
│ │   Giá theo thùng: [ 480.000    ] đ                                                      │ │
│ │   Ghi chú:        [ 1 Thùng = 6 Hộp (550ml)                                           ] │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│ 💡 Xem trước công thức quy đổi:                                                             │
│    • Đơn vị cơ sở: 1 Hộp (550ml) — Giá: 85.000 đ                                            │
│    • Đơn vị đóng gói: 1 Thùng = 6 Hộp (550ml) — Giá: 480.000 đ                              │
│                                                                                             │
│ [ Hủy ]                                                                    [ + Tạo vật tư ] │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2. Modal Chi tiết & Chọn Đơn vị Đặt hàng (ProductDetailDialog)
Khi nhân viên bấm vào sản phẩm để thêm vào giỏ yêu cầu:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Keo dán bạt trang trại                                                                     │
│ Keo chuyên dụng chống thấm, dán vá bạt che trại kín                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Danh sách đơn vị cấp phát:                                                                  │
│                                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ (●) [Ảnh]  Thùng = 6 Hộp (550ml)                                        [ MẶC ĐỊNH ]    │ │
│ │            1 Thùng = 6 Hộp (quy đổi tự động)                     Tồn: 10 Thùng khả dụng │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ( ) [Ảnh]  550ml                                                                        │ │
│ │            Đơn vị: Hộp                                            Tồn: 64 Hộp khả dụng  │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│ Số lượng (Thùng):   [ − ]  [   2   ]  [ + ]                                                 │
│                                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 💡 Quy đổi: 2 Thùng = 12 Hộp (550ml)                       Kho sẽ xuất nguyên kiện      │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Đóng ]                                                            [ + Thêm vào giỏ hàng ] │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.3. Hiển thị trên Giỏ hàng & Phiếu Yêu cầu Cấp phát (RequisitionForm)
* Dòng vật tư trong giỏ hàng và trên phiếu yêu cầu:
  * **Tên:** Keo dán bạt trang trại
  * **Quy cách yêu cầu:** 1 Thùng = 6 Hộp (550ml)
  * **Số lượng:** 2 Thùng
  * **Ghi chú chuẩn bị:** = 12 Hộp (550ml)

---

## 5. MA TRẬN PHÂN QUYỀN (SECURITY & RLS MATRIX)

| Vai trò (Role) | Tạo / Sửa Vật tư Quy đổi | Xem Danh mục & Chọn ĐVT | Gửi Phiếu Yêu cầu | Duyệt Cấp phát & Trừ kho | Nhập kho Quy đổi |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Quản lý / Ban Giám đốc (Admin/Manager)** | ✅ Toàn quyền | ✅ Có | ✅ Có | ✅ Toàn quyền duyệt | ✅ Có |
| **Thủ kho (Warehouse Manager)** | ✅ Toàn quyền | ✅ Có | ✅ Có | ✅ Xuất kho & Trừ kho | ✅ Toàn quyền |
| **Kỹ thuật / Nhân viên trại (Technician/Staff)** | ❌ Không có quyền | ✅ Tự do chọn ĐVT | ✅ Gửi yêu cầu | ❌ Không | ❌ Không |

---

## 6. KỊCH BẢN KIỂM THỬ & TIÊU CHÍ NGHIỆM THU (TEST SUITE & ACCEPTANCE)

### 6.1. Ma trận Kiểm thử Tự động (Automated Test Suite)
1. **Kiểm thử Schema & Validation (schema.test.ts):**
   - [x] Validate thành công khi khai báo baseUnit, baseSpec, conversions hợp lệ.
   - [x] Bắt lỗi khi danh sách conversions rỗng hoặc tỷ lệ quy đổi < 1.
   - [x] Bắt lỗi khi tên đơn vị quy đổi trùng với tên đơn vị cơ sở.
2. **Kiểm thử Giao diện Đặt hàng & Quy đổi (product-detail-dialog.test.tsx):**
   - [x] Hiển thị đúng danh sách đơn vị quy đổi (Thùng và Hộp).
   - [x] Tự động tính toán số lượng quy đổi tương đương khi người dùng thay đổi số lượng (2 Thùng -> 12 Hộp).
   - [x] Đưa vào giỏ hàng đúng variantId, unit và quantity.
3. **Kiểm thử Toàn hệ thống (Full Regression Suite):**
   - [x] Chạy toàn bộ **61 test files / 349 test cases**: 100% PASS.

---

## 7. KẾT LUẬN & HƯỚNG DẪN BẢO TRÌ

Tính năng **Quy đổi Đơn vị & Đóng gói Đa cấp** đã được triển khai hoàn chỉnh, mang lại trải nghiệm tối ưu cho cả nhân viên kỹ thuật trang trại và thủ kho. Kiến trúc tận dụng bảng variant_components giúp hệ thống hoàn toàn tương thích với dữ liệu lịch sử, không tạo ra nợ kỹ thuật và sẵn sàng mở rộng cho các phân hệ ERP nâng cao trong tương lai.
