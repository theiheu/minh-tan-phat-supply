# Hệ thống Quản trị Toàn diện Trại gà Đẻ trứng Công nghiệp (MTP Farm ERP) — Design Spec

**Dự án:** Minh Tân Phát Supply & Farm ERP  
**Đơn vị áp dụng:** Trại gà đẻ trứng Lê Văn Dương (Ấp Tân Tiến, Xã Minh Tân, Huyện Dầu Tiếng, Tỉnh Bình Dương)  
**Tác giả:** Antigravity Team  
**Ngày lập:** 12/09/2026  
**Trạng thái:** Approved / Ready for Future Implementation  

---

## 1. TỔNG QUAN HỆ THỐNG & TẦM NHÌN (VISION)

Hệ thống hiện tại đã hoàn thiện xuất sắc mảng **Quản lý Vật tư, Kho bãi, Thiết bị Cơ điện, Nhiên liệu Xăng dầu, Báo hỏng - Đổi mới - Sửa chữa và Báo cáo Xuất Nhập Tồn**.

Để mở rộng hệ thống thành nền tảng **ERP Quản trị Trại gà Toàn diện (Smart Poultry Farm ERP)**, hệ thống sẽ được mở rộng thêm 5 phân hệ cốt lõi:
1. **Module EGG & FLOCK:** Quản lý lứa gà, đàn gà sống/chết/thải loại, thu hoạch trứng theo ca/dãy, phân loại trứng và xuất bán trứng thương phẩm.
2. **Module FEED & FCR:** Quản lý tiêu thụ thức ăn cám, định mức ăn (g/con/ngày), tính toán hiệu suất chuyển hóa FCR và cảnh báo ăn giảm.
3. **Module VET & BIO-SECURITY:** Lịch vắc-xin tự động theo tuần tuổi, nhật ký dùng thuốc, cảnh báo thời gian cách ly thuốc (Withdrawal period).
4. **Module FINANCIAL & COSTING:** Báo cáo giá thành sản xuất 1 quả trứng (Cost per Egg), tổng hợp P&L doanh thu - chi phí lãi/lỗ theo ngày/chuồng.
5. **Module HR & ENVIRONMENT:** Chấm công ca nhặt trứng, công thức thưởng năng suất chuồng, nhật ký giám sát nhiệt độ/độ ẩm chuồng kín.

---

## 2. KIẾN TRÚC DỮ LIỆU TỔNG THỂ (DATABASE ARCHITECTURE)

### 2.1. Phân hệ Đàn gà & Lứa gà (Flock & Batch Management)

```sql
-- 1. Quản lý Đàn / Lứa gà tại từng Dãy chuồng
create table public.flocks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                  -- VD: 'LUA-2026-01-C1'
  zone_id uuid not null references public.zones(id),
  sub_zone_id uuid references public.sub_zones(id),
  breed_name text not null default 'Gà Isa Brown', -- Giống gà: Isa Brown, H&N Brown, Hy-Line Brown
  hatch_date date not null,                   -- Ngày nở (để tính tuần tuổi)
  placed_date date not null,                  -- Ngày nhập về trại
  initial_quantity integer not null,          -- Số lượng gà nhập ban đầu (VD: 10.000 con)
  current_quantity integer not null,          -- Số lượng gà sống hiện tại
  status text not null default 'laying',      -- 'rearing' (hậu bị), 'laying' (đang đẻ), 'culled' (đã loại)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Nhật ký biến động đàn hàng ngày (Gà chết & Gà loại thải)
create table public.flock_mortality_logs (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.flocks(id) on delete cascade,
  log_date date not null,
  dead_count integer not null default 0,      -- Số con chết trong ngày
  culled_count integer not null default 0,    -- Số con loại thải (ốm, liệt lồng)
  death_cause text,                           -- 'heat_stress' (sốc nhiệt), 'e_coli', 'egg_bound', 'unknown'...
  recorder_id uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  unique (flock_id, log_date)
);
```

### 2.2. Phân hệ Thu hoạch & Phân loại Trứng (Egg Production & Grading)

```sql
-- 3. Nhật ký thu trứng hàng ngày theo Ca và Dãy chuồng
create table public.egg_collections (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.flocks(id),
  collection_date date not null,
  shift text not null default 'morning',      -- 'morning' (sáng), 'afternoon' (chiều)
  total_eggs integer not null default 0,      -- Tổng số quả thu được
  grade_1 integer not null default 0,         -- Trứng loại 1 (chuẩn thương phẩm 60-65g)
  grade_2 integer not null default 0,         -- Trứng loại 2 (nhỏ 50-55g)
  grade_jumbo integer not null default 0,     -- Trứng 2 lòng đỏ (Jumbo)
  deformed integer not null default 0,        -- Trứng méo / sần sùi
  cracked integer not null default 0,         -- Trứng dập / nứt vỏ
  dirty integer not null default 0,           -- Trứng bẩn dính phân
  laying_rate_percent numeric(5,2),           -- Tự động tính: (total_eggs / current_quantity) * 100
  collector_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 4. Bảng giá trứng xuất bán theo ngày (Thị trường trứng biến động theo ngày)
create table public.egg_price_rates (
  id uuid primary key default gen_random_uuid(),
  effective_date date not null,
  price_grade_1 numeric(10,2) not null,       -- Đơn giá trứng loại 1 (VD: 1.850 đ/quả)
  price_grade_2 numeric(10,2) not null,       -- Đơn giá trứng loại 2 (VD: 1.600 đ/quả)
  price_jumbo numeric(10,2) not null,         -- Đơn giá trứng Jumbo (VD: 2.100 đ/quả)
  price_cracked numeric(10,2) not null,       -- Đơn giá trứng dập (VD: 1.000 đ/quả)
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (effective_date)
);

-- 5. Phiếu xuất bán trứng cho thương lái / đại lý
create table public.egg_sales (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                  -- VD: 'BAN-TRUNG-2026-001'
  sale_date date not null default current_date,
  customer_id uuid not null references public.customers(id),
  total_quantity integer not null,            -- Tổng số quả
  total_amount numeric(15,2) not null,        -- Tổng thành tiền
  payment_status text not null default 'paid',-- 'paid', 'partial', 'debt'
  paid_amount numeric(15,2) not null default 0,
  vehicle_plate text,
  driver_name text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.egg_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.egg_sales(id) on delete cascade,
  egg_grade text not null,                    -- 'grade_1', 'grade_2', 'jumbo', 'cracked'
  quantity integer not null,
  unit_price numeric(10,2) not null,
  total_amount numeric(12,2) not null
);
```

### 2.3. Phân hệ Tiêu thụ Cám & FCR (Feed & Nutrition)

```sql
-- 6. Nhật ký cấp cám cho từng chuồng hàng ngày
create table public.flock_feed_consumptions (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.flocks(id),
  log_date date not null,
  variant_id uuid not null references public.variants(id), -- Loại cám (Cám gà đẻ 18% đạm, Cám hậu bị...)
  bags_count numeric(6,2) not null,          -- Số bao (VD: 25 bao)
  total_kg numeric(8,2) not null,            -- Tổng số kg (VD: 1.000 kg)
  gram_per_bird numeric(6,2),                -- Định mức ăn: (total_kg * 1000) / current_quantity (g/con)
  cost_amount numeric(12,2),                 -- Chi phí cám = total_kg * giá vốn
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (flock_id, log_date, variant_id)
);
```

### 2.4. Phân hệ Thú y, Vắc-xin & An toàn Sinh học (Veterinary)

```sql
-- 7. Lịch vắc-xin chuẩn theo tuần tuổi
create table public.vaccine_schedules (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.flocks(id),
  target_age_weeks integer not null,          -- Tuần tuổi cần làm (VD: tuần 3, tuần 16)
  target_date date not null,                  -- Ngày dự kiến
  variant_id uuid not null references public.variants(id), -- Loại vắc-xin / Thuốc
  method text not null,                       -- 'drinking_water' (pha nước), 'injection' (tiêm), 'eye_drop' (nhỏ mắt), 'spray' (phun)
  status text not null default 'pending',     -- 'pending', 'completed', 'skipped'
  completed_at timestamptz,
  administered_by uuid references public.profiles(id),
  notes text
);

-- 8. Nhật ký điều trị bệnh & Thời gian cách ly thuốc
create table public.flock_treatments (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.flocks(id),
  start_date date not null,
  end_date date not null,
  disease_diagnosed text not null,            -- Chẩn đoán: CRD, E.Coli, Cầu trùng, Viêm ruột...
  variant_id uuid not null references public.variants(id), -- Kháng sinh / Hóa dược
  dosage text not null,                       -- Liều dùng (VD: 1g / 2 lít nước)
  withdrawal_days integer not null default 0, -- Thời gian ngưng thuốc (cách ly) (VD: 7 ngày)
  safe_to_sell_date date not null,            -- Ngày an toàn để xuất bán trứng/thịt trở lại
  prescribed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
```

---

## 3. THIẾT KẾ CÁC MÀN HÌNH CHÍNH (UI/UX SPECIFICATIONS)

### 3.1. Dashboard Sản xuất Nông trại (`/production`)
- **Card 1: Tổng số trứng hôm nay:** Số lượng quả, so sánh với hôm qua ($pm%$).
- **Card 2: Tỷ lệ đẻ trung bình toàn trại:** $	ext{Laying Rate} = 92.4%$.
- **Card 3: Tỷ lệ hao hụt / Gà chết hôm nay:** $14 / 85.000$ con ($0.016%$).
- **Card 4: Tiêu thụ cám & FCR tuần:** $115	ext{g/con/ngày}$ — FCR: $2.12	ext{ kg cám / kg trứng}$.
- **Biểu đồ Đường cong Tỷ lệ đẻ (Egg Production Curve):** Trục hoành là tuần tuổi (Tuần 18 $ightarrow$ Tuần 80), so sánh đường thực tế với đường chuẩn giống gà (Standard Breed Curve).
- **Danh sách chuồng cần chú ý:** Bảng highlight các dãy chuồng có tỷ lệ đẻ sụt giảm $> 3%$ hoặc ăn giảm trong 2 ngày liên tiếp.

### 3.2. Màn hình Thu nhặt Trứng (`/production/eggs`)
- Giao diện thân thiện trên điện thoại cho công nhân chuồng:
  - Chọn Dãy chuồng (Sub-zone) $ightarrow$ Nhập số trứng nhặt Ca sáng / Ca chiều.
  - Nhập nhanh số lượng trứng dập, trứng méo, trứng bẩn.
  - Tự động hiển thị ngay % Đẻ tức thì của chuồng đó để công nhân biết kết quả.

### 3.3. Màn hình Lịch Vắc-xin & Thú y (`/vet`)
- Dạng Lịch (Calendar View) & Danh sách nhắc việc (Todo List).
- Badge cảnh báo màu đỏ: Các chuồng đang trong giai đoạn ngưng thuốc (Withdrawal period) cảnh báo không được xuất bán gà thịt.
- Nút bấm 1 chạm: "Đã tiêm / Đã cho uống" $ightarrow$ Tự động tạo phiếu xuất kho thuốc thú y tương ứng trong kho vật tư!

### 3.4. Màn hình Giá thành 1 quả trứng & P&L (`/reports/farm-pnl`)
- Bộ lọc theo Tháng / Quý / Lứa gà.
- Công thức tính tự động:
  $$	ext{Giá thành 1 quả trứng} = rac{	ext{Chi phí Thức ăn} + 	ext{Khấu hao Gà giống} + 	ext{Thuốc/Vắc-xin} + 	ext{Điện/Dầu/Vật tư} + 	ext{Nhân công}}{	ext{Tổng số quả trứng loại 1 + loại 2 sản xuất}}$$
- So sánh giá thành với giá bán bình quân để tính Lãi ròng (Net Profit) của trại theo ngày/tháng.

---

## 4. TÍNH NĂNG TÍCH HỢP CHẶT CHẼ VỚI HỆ THỐNG VẬT TƯ HIỆN TẠI

1. **Tự động trừ kho cám & thuốc khi ghi nhật ký trại:**
   Khi công nhân chuồng ghi nhận đổ 30 bao cám hoặc dùng 5 chai vắc-xin, hệ thống tự động sinh phiếu xuất kho nội bộ (`issues`) trừ tồn kho chính, không cần thủ kho phải nhập tay lại.
2. **Kế thừa hệ thống Khu vực & Dãy chuồng (`zones`, `sub_zones`):**
   Mọi dữ liệu đàn gà, trứng, thức ăn, thiết bị cơ điện, máy phát điện đều gắn liền với ID phân cấp khu/dãy chuồng chuẩn đã xây dựng.
3. **Kế thừa hệ thống Quét QR & In phiếu PDF A4:**
   In phiếu xuất bán trứng cho thương lái, in tem QR dán đầu dãy chuồng để công nhân quét mã là mở ngay form nhặt trứng của chuồng đó.
