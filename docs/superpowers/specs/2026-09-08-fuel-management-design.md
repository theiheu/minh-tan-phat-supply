# Đặc tả: Phân hệ Quản lý Kho Dầu (Fuel Management Subsystem)

Ngày: 2026-09-08 · Trạng thái: Chờ duyệt · Phạm vi: repo `minh-tan-phat-supply`

---

## 1. Bối cảnh & Mục tiêu

Trại cần bổ sung một phân hệ chuyên biệt để **quản lý nhiên liệu (Dầu Diesel DO, Dầu thủy lực, Nhớt bôi trơn, Xăng...)** nhằm kiểm soát chặt chẽ:
1. **Quản lý Xuất - Nhập - Tồn kho dầu**: Theo dõi tồn kho thực tế theo thời gian thực (đơn vị Lít), ghi nhận lịch sử nhập từ nhà cung cấp và lịch sử cấp phát.
2. **Theo dõi cấp phát theo Phương tiện & Khu vực**: Ghi nhận chi tiết lượng dầu cấp cho từng Xe / Máy móc / Thiết bị (kèm số Odo Km hoặc Giờ máy hoạt động) và phân bổ theo Khu vực / Đội / Phân xưởng.
3. **Tính năng Quét mã QR Cấp tốc**:
   - Quét mã QR dán trên Xe / Thiết bị -> Tự động nhận diện xe, tài xế, odo lần trước -> Nhập số lít và odo mới -> Xác nhận hoàn tất cấp dầu trong 5 giây.
   - Hỗ trợ quét mã QR của phiếu yêu cầu cấp dầu nếu có duyệt trước.
4. **Quản lý Danh mục Phương tiện & Tem in QR**: Quản lý danh sách xe/máy móc tại trang Quản trị, có chức năng tạo và in tem mã QR dán xe.
5. **Báo cáo & Phân tích tiêu hao**: Báo cáo tổng hợp xuất-nhập-tồn, chi tiết tiêu thụ theo xe (Lít/100km hoặc Lít/giờ) và theo khu vực, hỗ trợ xuất file Excel.

---

## 2. Phạm vi

### 2.1. Trong phạm vi
1. **Cơ sở dữ liệu (Supabase Postgres)**:
   - Danh mục Phương tiện & Máy móc (`vehicles`).
   - Danh mục Loại Dầu / Nhiên liệu (`fuel_types`).
   - Phiếu Nhập Dầu (`fuel_receipts`).
   - Phiếu Xuất / Cấp phát Dầu (`fuel_dispenses`).
   - Sổ cái biến động kho dầu (`fuel_movements`).
   - Các hàm RPC xử lý Transaction an toàn: `create_fuel_receipt`, `create_fuel_dispense`, `quick_scan_fuel_dispense`, `cancel_fuel_dispense`, `cancel_fuel_receipt`.
   - Chính sách RLS (Row Level Security) theo vai trò.
2. **Giao diện người dùng (UI / UX)**:
   - Menu chính: Tab **"Kho dầu" (`/fuel`)** với 4 tab con (Tổng quan & Tồn kho, Cấp phát dầu, Nhập kho, Báo cáo).
   - Trang **Quét mã QR cấp tốc (`/fuel/scan`)** tối ưu cho Mobile/Tablet với Camera Scanner.
   - Trang **Quản trị Phương tiện (`/admin/vehicles`)** với CRUD xe + Hộp thoại in tem QR chuẩn cho từng xe hoặc in hàng loạt.
   - Tích hợp in Phiếu Nhập Dầu và Phiếu Cấp Dầu theo mẫu in chuẩn `StandardSlip`.
3. **Báo cáo & Xuất dữ liệu**:
   - Báo cáo xuất-nhập-tồn kho dầu.
   - Báo cáo định mức tiêu hao theo xe (tự động tính chênh lệch Odo và mức tiêu thụ Lít/100km hoặc Lít/giờ).
   - Báo cáo theo khu vực / công trình.
   - Xuất Excel (`.xlsx`).

### 2.2. Ngoài phạm vi
- Tích hợp phần cứng cảm biến dòng chảy / đồng hồ đo lưu lượng tự động kết nối qua IoT (nhân viên đọc số trên đồng hồ cơ/điện tử và nhập vào app hoặc chụp ảnh).
- Tích hợp trạm xăng dầu công cộng bên ngoài.

---

## 3. Thiết kế Cơ sở Dữ liệu (Database Schema)

### 3.1. Bảng `fuel_types` (Danh mục Loại Dầu & Nhiên liệu)
```sql
create table public.fuel_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,               -- VD: 'DIESEL_DO_005', 'HYDRAULIC_68', 'ENGINE_OIL_15W40', 'RON_95'
  name text not null,                      -- VD: 'Dầu Diesel DO 0.05S-II', 'Dầu thủy lực ISO VG 68'
  unit text not null default 'lít',        -- ĐVT: lít, can, phuy, thùng
  current_stock numeric(12,2) not null default 0 check (current_stock >= 0),
  min_stock numeric(12,2) not null default 0,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.2. Bảng `vehicles` (Danh mục Phương tiện & Máy móc)
```sql
create type public.vehicle_type as enum (
  'truck',        -- Xe tải / Xe ben / Xe đầu kéo
  'excavator',    -- Xe cuốc / Xe đào / Xe xúc lật
  'generator',    -- Máy phát điện
  'car',          -- Xe bán tải / Xe con công vụ
  'forklift',     -- Xe nâng
  'tractor',      -- Máy cày / Máy kéo
  'other'         -- Thiết bị máy móc khác
);

create type public.fuel_calc_unit as enum ('km', 'hours');

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,               -- Biển số xe hoặc Mã máy (vd: '61C-123.45', 'MAY-XUC-01')
  name text not null,                      -- Tên xe/thiết bị (vd: 'Xe ben Howo 4 chân 371HP', 'Xe xúc Komatsu PC200')
  type public.vehicle_type not null default 'truck',
  zone_id uuid references public.zones(id) on delete set null,
  default_driver text,                     -- Tên tài xế / người phụ trách lái chính
  fuel_type_id uuid references public.fuel_types(id) on delete restrict,
  current_odo numeric(12,2) not null default 0, -- Chỉ số km (Odo) hoặc số giờ máy hiện tại
  odo_unit public.fuel_calc_unit not null default 'km', -- Đơn vị tính: 'km' hoặc 'hours'
  fuel_norm numeric(10,2),                 -- Định mức tham khảo (Lít/100km hoặc Lít/giờ)
  qr_token text not null unique,           -- Mã định danh duy nhất dùng cho QR Code (vd: 'VEH_61C12345_A8B9')
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.3. Bảng `fuel_receipts` (Phiếu Nhập Kho Dầu)
```sql
create table public.fuel_receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,               -- Mã phiếu tự sinh (vd: 'NKD-20260908-0001')
  supplier_id uuid references public.suppliers(id) on delete restrict,
  fuel_type_id uuid not null references public.fuel_types(id) on delete restrict,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  invoice_number text,                     -- Số hóa đơn GTGT / Số phiếu giao hàng NCC
  invoice_images text[] not null default '{}', -- Link ảnh hóa đơn / phiếu cân / phiếu giao
  received_by uuid not null references public.profiles(id),
  notes text,
  status text not null default 'completed' check (status in ('draft', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.4. Bảng `fuel_dispenses` (Phiếu Cấp Phát / Xuất Dầu)
```sql
create table public.fuel_dispenses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,               -- Mã phiếu tự sinh (vd: 'CKD-20260908-0001')
  vehicle_id uuid references public.vehicles(id) on delete set null,
  zone_id uuid references public.zones(id) on delete set null,
  fuel_type_id uuid not null references public.fuel_types(id) on delete restrict,
  quantity numeric(12,2) not null check (quantity > 0),
  
  -- Theo dõi Odo & Tiêu hao:
  previous_odo numeric(12,2),             -- Chỉ số Odo/giờ cũ trước khi cấp
  current_odo numeric(12,2),              -- Chỉ số Odo/giờ mới ghi nhận tại lần cấp này
  usage_diff numeric(12,2),               -- Quãng đường (km) hoặc số giờ chạy = current_odo - previous_odo
  consumption_rate numeric(10,2),         -- Tiêu hao thực tế: (quantity / usage_diff * 100 nếu km) hoặc (quantity / usage_diff nếu giờ)
  
  driver_name text,                        -- Tên tài xế / người nhận dầu
  dispenser_id uuid not null references public.profiles(id), -- Người thực hiện cấp dầu
  meter_images text[] not null default '{}', -- Ảnh chụp đồng hồ bơm hoặc đồng hồ Odo
  notes text,
  status text not null default 'completed' check (status in ('draft', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.5. Bảng `fuel_movements` (Sổ cái Biến động Tồn kho Dầu)
```sql
create type public.fuel_movement_type as enum (
  'receipt_in',        -- Nhập dầu từ NCC
  'dispense_out',      -- Xuất cấp phát cho xe / khu vực
  'adjustment_in',     -- Điều chỉnh kiểm kê tăng
  'adjustment_out',    -- Điều chỉnh kiểm kê giảm
  'cancel_revert'      -- Hoàn trả do huỷ phiếu
);

create table public.fuel_movements (
  id uuid primary key default gen_random_uuid(),
  fuel_type_id uuid not null references public.fuel_types(id),
  movement_type public.fuel_movement_type not null,
  quantity numeric(12,2) not null,         -- Dương nếu tăng, âm nếu giảm (hoặc lưu số tuyệt đối + movement_type)
  balance_after numeric(12,2) not null,    -- Tồn kho sau giao dịch
  ref_type text not null,                  -- 'fuel_receipts' | 'fuel_dispenses' | 'fuel_adjustments'
  ref_id uuid not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
```

---

## 4. Các Hàm Nghiệp vụ Database (PostgreSQL Stored Procedures / RPCs)

1. **`create_fuel_receipt(p_supplier_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_unit_price numeric, p_invoice_number text, p_invoice_images text[], p_notes text, p_by uuid) → uuid`**
   - Tạo mã phiếu `NKD-YYYYMMDD-XXXX`.
   - Thêm bản ghi vào `fuel_receipts`.
   - Tăng `current_stock` trong `fuel_types`.
   - Ghi sổ vào `fuel_movements` với `movement_type = 'receipt_in'`.

2. **`create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid) → uuid`**
   - Kiểm tra tồn kho `fuel_types.current_stock >= p_quantity`. Nếu không đủ -> Raise Exception `KHONG_DU_TON_KHO`.
   - Lấy thông tin `previous_odo` của xe (nếu có `p_vehicle_id`).
   - Tính toán `usage_diff = p_current_odo - previous_odo` (nếu `p_current_odo > previous_odo`).
   - Tính toán `consumption_rate`:
     - Nếu đơn vị `km`: `(p_quantity / usage_diff) * 100` (Lít/100km).
     - Nếu đơn vị `hours`: `p_quantity / usage_diff` (Lít/giờ).
   - Cập nhật `vehicles.current_odo = p_current_odo` (nếu số odo mới hợp lệ và lớn hơn odo cũ).
   - Tạo mã phiếu `CKD-YYYYMMDD-XXXX`.
   - Thêm bản ghi vào `fuel_dispenses`.
   - Giảm `current_stock` trong `fuel_types`.
   - Ghi sổ vào `fuel_movements` với `movement_type = 'dispense_out'`.

3. **`get_vehicle_by_qr(p_qr_token text) → jsonb`**
   - Tìm xe theo `qr_token` hoặc `code` (biển số xe).
   - Trả về thông tin xe: id, code, name, type, zone_id, zone_name, default_driver, fuel_type_id, fuel_type_name, current_odo, odo_unit, fuel_norm, last_dispense_info.

---

## 5. Thiết kế Giao diện & Trải nghiệm Người dùng (UI / UX)

### 5.1. Cấu trúc Menu Điều hướng
- **Thanh Menu Chính (Desktop Sidebar & Mobile Nav)**:
  - Thêm tab: **"Kho dầu" (`/fuel`)** với icon `Fuel` (hoặc `Droplet`).
  - Phân quyền: `manager`, `superuser` (Xem đầy đủ); `requester` / nhân viên có thể truy cập `/fuel/scan` để quét mã cấp dầu.
- **Thanh Menu Quản trị (`/admin`)**:
  - Thêm tab: **"Phương tiện / Xe" (`/admin/vehicles`)** với icon `Truck`.

### 5.2. Các Phân trang Chi tiết

#### A. Tab Tổng quan Kho Dầu (`/fuel`)
- **Metric Cards (Chỉ số Tồn kho & Hoạt động)**:
  - Card 1: **Tồn kho Dầu Diesel DO** (Lít) + Thanh tỷ lệ an toàn.
  - Card 2: **Tồn các loại Nhớt & Dầu khác** (Lít / Can).
  - Card 3: **Tổng cấp trong ngày / tháng** (Lít).
  - Card 4: **Tổng nhập trong tháng** (Lít & Giá trị VNĐ).
- **Hành động nhanh**:
  - `[ 📷 Quét mã cấp dầu ]` (Nút nổi bật màu vàng/xanh mở camera).
  - `[ ➕ Cấp phát dầu ]` (Mở modal nhập thủ công).
  - `[ 📥 Nhập kho dầu ]` (Mở modal nhập dầu NCC).
- **Biểu đồ & Bảng phân tích**:
  - Biểu đồ Bar chart: Lượng dầu tiêu thụ theo từng **Khu vực / Phân xưởng** trong tháng.
  - Bảng xếp hạng Top 10 Xe tiêu thụ nhiều dầu nhất + Mức tiêu hao trung bình (L/100km hoặc L/h).

#### B. Tab Cấp phát Dầu (`/fuel/dispenses`)
- Bảng danh sách phiếu cấp phát:
  - Cột: Mã phiếu, Thời gian, Phương tiện (Biển số / Tên xe), Khu vực, Loại dầu, Số lít, Số Odo/Giờ máy, Quãng đường/Giờ chạy (+/-), Mức tiêu hao (L/100km), Người nhận, Trực bơm, Ảnh, Nút Xem/In phiếu.
  - Bộ lọc linh hoạt: Khoảng ngày, Phương tiện, Khu vực, Loại nhiên liệu.
  - Nút "Tạo phiếu cấp dầu mới" & "Xuất Excel".

#### C. Tab Nhập kho Dầu (`/fuel/receipts`)
- Bảng danh sách phiếu nhập:
  - Cột: Mã phiếu, Ngày nhập, Nhà cung cấp, Loại dầu, Số lít, Đơn giá/Lít, Tổng tiền, Số HĐ GTGT, Ảnh chứng từ, Người nhận, Thao tác.
  - Nút "Nhập dầu mới" (Hỗ trợ tải lên ảnh hóa đơn GTGT, phiếu giao hàng).

#### D. Trang Quét mã QR Cấp tốc (`/fuel/scan`)
- Giao diện thiết kế chuyên biệt trên Mobile:
  - Khung quét Camera Realtime có hỗ trợ bật đèn Flash và chuyển Camera trước/sau.
  - Ô tìm kiếm / gõ biển số nhanh khi camera mờ/không nhận diện được.
  - Khi quét trúng mã QR Xe:
    - Hiển thị ngay Card thông tin xe: Biển số `61C-123.45`, Tên xe `Xe ben Howo`, Khu vực `Đội xe 1`, Tài xế `Nguyễn Văn A`, Odo lần trước `12,450 km`.
    - Form nhập liệu rút gọn:
      1. **Số lít dầu lấy**: `[ 150 ]` Lít (Bàn phím số tự mở).
      2. **Số Odo / Giờ máy mới**: `[ 12,780 ]` km (Hệ thống tính: `Chạy +330 km | Tiêu hao 45.45 L/100km`).
      3. **Tài xế nhận**: Tự điền `Nguyễn Văn A` (cho phép đổi).
      4. **Ảnh đồng hồ**: Nút chụp ảnh nhanh.
      5. Nút bấm to: **"✅ XÁC NHẬN CẤP DẦU"**.
    - Sau khi bấm xác nhận: Hiện thông báo thành công xanh lá, hiển thị mã phiếu và nút "Tiếp tục quét xe khác".

#### E. Trang Quản lý Phương tiện (`/admin/vehicles`)
- Quản lý danh mục Xe & Thiết bị:
  - Thêm, sửa, vô hiệu hóa xe.
  - Các trường: Biển số/Mã máy, Tên xe, Loại máy, Khu vực, Tài xế phụ trách, Loại dầu mặc định, Định mức tiêu hao tham khảo (L/100km hoặc L/h), Odo ban đầu.
- **Tính năng In Tem Mã QR Dán Xe**:
  - Hộp thoại tạo tem mã QR định dạng chuẩn (kèm Logo trại, Tên trại, Mã xe, Biển số, Loại dầu).
  - Hỗ trợ in 1 xe hoặc in khổ A4 chứa lưới nhiều tem QR để dán toàn bộ đội xe.

#### F. Tab Báo cáo Tiêu hao Nhiên liệu (`/fuel/reports`)
- Báo cáo tổng hợp Xuất - Nhập - Tồn theo kỳ.
- Báo cáo chi tiết định mức tiêu hao từng phương tiện:
  - Bảng so sánh giữa Định mức tiêu chuẩn và Tiêu hao thực tế (Cảnh báo màu đỏ nếu xe tiêu hao vượt định mức > 15%).
- Báo cáo phân bổ chi phí dầu theo từng Khu vực.
- Nút Xuất file Excel chuẩn (`.xlsx`).

---

## 6. Mẫu In Phiếu Dầu & Tem QR Chuẩn

### 6.1. Phiếu Nhập Kho Dầu (`fuel-receipt-pdf`) & Phiếu Cấp Dầu (`fuel-dispense-pdf`)
- Sử dụng framework mẫu in `StandardSlip` (`src/features/pdf/slip.tsx`).
- Đầu phiếu chuẩn thương hiệu:
  - `TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG`
  - Địa chỉ: `Ấp Tân Tiến, xã Minh Tân, huyện Dầu Tiếng, tỉnh Bình Dương`
  - SĐT: `0988 365 238 – 0963 077 879`
- Thông tin phiếu cấp: Tên người nhận/tài xế, Biển số xe, Khu vực, Số lít cấp phát, Chỉ số Odo/giờ máy, Tiêu hao đo được.
- Bảng chữ ký 4 bên: Người nhận (Tài xế) · Trực bơm · Thủ kho · Quản lý/Chủ trại.

### 6.2. Tem Mã QR Xe dán tại buồng lái
- Khổ in tem nhãn (Decal): 60mm x 40mm hoặc lưới A4.
- Nội dung tem:
  - Logo / Tên: `TRẠI LÊ VĂN DƯƠNG - QUẢN LÝ NHIÊN LIỆU`
  - Mã QR Code chất lượng cao (quét được từ khoảng cách 1m).
  - Biển số / Mã xe in đậm lớn: `61C-123.45`
  - Tên xe: `Xe ben Howo 4 chân` · Loại dầu: `Dầu DO 0.05S`

---

## 7. Kế hoạch Kiểm thử & Đảm bảo Chất lượng

1. **Unit & Integration Tests**:
   - `fuel.test.ts`: Kiểm tra tính toán chênh lệch Odo, định mức tiêu hao `L/100km` và `L/giờ`.
   - `fuel-rpc.test.ts`: Kiểm tra transaction nhập/xuất kho dầu, kiểm tra chặn xuất vượt tồn, kiểm tra rollback khi huỷ phiếu.
   - `qr-vehicle.test.ts`: Kiểm tra giải mã token QR xe và nhận diện thông tin xe.
2. **UI & Verification**:
   - Kiểm tra giao diện Mobile Scanner trên Safari/Chrome mobile.
   - Kiểm tra xuất file Excel báo cáo tiêu thụ nhiên liệu.
   - Kiểm tra in PDF phiếu cấp dầu và in tem QR xe.

---

## 8. Các Bước Triển Khai Kế tiếp
1. Chờ phê duyệt Spec từ người dùng.
2. Khởi tạo Kế hoạch Thực hiện Chi tiết (`writing-plans`).
3. Tạo Migration Database và chạy Seed dữ liệu ban đầu cho các loại dầu và danh mục xe mẫu.
4. Xây dựng Server Actions, RPCs và tích hợp Logic.
5. Xây dựng giao diện UI (Tab Kho Dầu, Quét QR, Quản lý Xe, Báo cáo).
6. Viết Tests và nghiệm thu toàn diện.
