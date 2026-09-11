# Đặc tả Thiết kế: Quản lý Trại/Xưởng Trực thuộc Khu vực (Sub-zones Management)

Ngày: 2026-09-10 · Trạng thái: Chờ duyệt · Phạm vi: repo `minh-tan-phat-supply`

---

## 1. Bối cảnh & Mục tiêu

Tại Trại gà Minh Tân Phát, hệ thống phân cấp địa bàn hoạt động gồm 2 cấp độ:
1. **Cấp 1 - Khu vực (Zone):** Đại diện cho các đại khu quy hoạch lớn (Ví dụ: `Khu 1`, `Khu 2`, `Khu 3`, `Khu 4`).
2. **Cấp 2 - Trại / Phân xưởng trực thuộc (Sub-zone):** Đại diện cho các đơn vị chuồng trại hoặc cơ sở chức năng nằm bên trong từng Khu:
   - *Khu 1 (Trại gà thịt A):* Trại 1, Trại 2, Trại 3...
   - *Khu 2 (Trại gà hậu bị B):* Trại 4, Trại 5, Trại 6...
   - *Khu 3 (Khu ấp trứng & xưởng cơ điện):* Nhà ấp trứng, Xưởng cơ điện...
   - *Khu 4 (Khu xử lý chất thải & trạm bơm):* Xưởng phân, Trạm bơm...

### Yêu cầu người dùng:
- Cho phép tạo và quản lý danh sách Trại / Xưởng trực thuộc trong tab **Quản trị Khu vực** (`/admin/zones`).
- Trong tất cả các tính năng yêu cầu Khu vực (Phiếu yêu cầu, Phiếu xuất kho, Mượn dụng cụ, Cấp phát dầu, Quản lý xe, Người dùng):
  - Khi chọn Khu vực, người dùng có thể chọn tiếp Trại/Xưởng trực thuộc (nếu khu đó có cấu hình trại).
  - Hiển thị đồng bộ theo định dạng: `[Khu] - [Trại/Xưởng]` (Ví dụ: `Khu 1 - Trại 1`, `Khu 4 - Xưởng phân`).
  - Hiển thị đầy đủ thông tin này trên danh sách, chi tiết phiếu, mẫu in PDF và báo cáo xuất file.

---

## 2. Thiết kế Cơ sở Dữ liệu (Database Schema)

### 2.1. Bảng mới `public.sub_zones` (Trại / Phân xưởng con)
```sql
create table public.sub_zones (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  name text not null,
  description text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_sub_zones_zone_id on public.sub_zones(zone_id);
create unique index idx_sub_zones_zone_name_unique on public.sub_zones(zone_id, lower(name)) where deleted_at is null;

-- RLS
alter table public.sub_zones enable row level security;
create policy "sub_zones_read_all" on public.sub_zones for select to authenticated using (true);
create policy "sub_zones_manager_modify" on public.sub_zones for all to authenticated using (public.is_manager());
```

### 2.2. Bổ sung liên kết `sub_zone_id` vào các bảng nghiệp vụ
```sql
-- 1. Phiếu yêu cầu
alter table public.requisitions add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_requisitions_sub_zone_id on public.requisitions(sub_zone_id);

-- 2. Phiếu xuất kho
alter table public.issues add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_issues_sub_zone_id on public.issues(sub_zone_id);

-- 3. Phiếu mượn dụng cụ
alter table public.tool_borrowings add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_tool_borrowings_sub_zone_id on public.tool_borrowings(sub_zone_id);

-- 4. Phiếu cấp phát nhiên liệu
alter table public.fuel_dispenses add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_fuel_dispenses_sub_zone_id on public.fuel_dispenses(sub_zone_id);

-- 5. Phương tiện / Xe
alter table public.vehicles add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
create index if not exists idx_vehicles_sub_zone_id on public.vehicles(sub_zone_id);

-- 6. Thông tin người dùng
alter table public.profiles add column if not exists sub_zone_id uuid references public.sub_zones(id) on delete set null;
```

### 2.3. Cập nhật các Function / RPC cốt lõi
- `create_requisition`: Nhận thêm `p_sub_zone_id uuid default null` và ghi vào `requisitions.sub_zone_id`.
- `create_issue`: Nhận thêm `p_sub_zone_id uuid default null` và ghi vào `issues.sub_zone_id`.
- `create_tool_borrowing`: Nhận thêm `p_sub_zone_id uuid default null` và ghi vào `tool_borrowings.sub_zone_id`.
- `create_fuel_dispense`: Nhận thêm `p_sub_zone_id uuid default null` và ghi vào `fuel_dispenses.sub_zone_id`.
- `admin_update_profile`: Cập nhật `sub_zone_id`.

---

## 3. Thiết kế Giao diện & Server Actions

### 3.1. Quản trị Khu vực (`/admin/zones`)
1. **Server Action `saveZoneWithSubZones` (`src/features/admin/actions.ts`):**
   - Lưu thông tin Zone: `name`, `description`.
   - Đồng bộ danh sách `sub_zones` của Zone đó (thêm mới, cập nhật hoặc soft-delete các trại đã xoá).
2. **Giao diện Quản lý Khu vực & Trại con (`src/features/admin/components/zone-manager.tsx`):**
   - Hiển thị danh sách Khu vực kèm danh sách Trại con dạng badges (VD: `[Trại 1] [Trại 2] [Trại 3]`).
   - Modal Thêm / Sửa Khu vực:
     - Tên khu vực (VD: `Khu 1`).
     - Mô tả khu vực.
     - Ô nhập thêm nhanh Trại/Xưởng: Nhập tên + nhấn Enter (hoặc bấm "Thêm").
     - Danh sách tags các trại đã thêm có nút (x) để xoá nhanh.

### 3.2. Form Nhập liệu có Khu vực (Cascading Zone -> Sub-zone)
Tạo component chọn khu vực tái sử dụng: `ZoneSubZoneSelect` hoặc tích hợp vào form:
1. **Phiếu yêu cầu (`RequisitionForm`, `RequisitionDialog`, Cart Drawer):**
   - Chọn `Khu vực` $\rightarrow$ Dropdown `Trại / Phân xưởng` tự động load danh sách trại của khu đó.
   - Nếu khu không có trại con, ẩn hoặc làm mờ dropdown trại con.
2. **Phiếu xuất kho (`IssueForm`):**
   - Khi chọn đích `Nội bộ khu` $\rightarrow$ Chọn Khu vực $\rightarrow$ Chọn Trại / Xưởng.
3. **Mượn dụng cụ (`ToolBorrowDialog`):**
   - Chọn Khu vực mượn $\rightarrow$ Chọn Trại / Xưởng.
4. **Cấp phát dầu (`FuelDispenseDialog`) & Phương tiện (`VehicleDialog`):**
   - Chọn Khu vực $\rightarrow$ Chọn Trại / Xưởng.
5. **Người dùng (`UsersManager`):**
   - Gán Khu vực mặc định và Trại / Xưởng mặc định cho nhân viên chuồng trại.

### 3.3. Định dạng & Hiển thị Thống nhất (Format Helper)
Tạo hàm tiện ích `formatZoneName(zone?: { name: string } | string | null, subZone?: { name: string } | string | null)`:
- Nếu có cả Khu và Trại: `Khu 1 - Trại 1` (hoặc `Khu 4 - Xưởng phân`).
- Nếu chỉ có Khu: `Khu 1`.
- Nếu không có: `—`.

Áp dụng cho:
- Bảng danh sách phiếu (Requisitions, Issues, Tools, Fuel).
- Chi tiết phiếu (Modal `SlipDetailModal`, trang `[id]/page.tsx`).
- Báo cáo tổng hợp & Xuất Excel (`ZoneCostReportTab`, `fuel-reports.tsx`, `excel-export.ts`).
- Các mẫu in PDF:
  - Phiếu yêu cầu (`/api/requisitions/[id]/pdf`)
  - Phiếu xuất kho (`/api/issues/[id]/pdf`)
  - Phiếu mượn dụng cụ (`/api/tools/[id]/pdf`)
  - Phiếu cấp nhiên liệu (`/api/fuel/dispenses/[id]/pdf`)
  - QR Code phương tiện (`/api/vehicles/[id]/qr`)

---

## 4. Kế hoạch Kiểm thử & Xác minh (Verification Plan)

1. **Unit Tests & Integration Tests:**
   - Test Server Action `saveZoneWithSubZones` (tạo zone + sub_zones, sửa tên, thêm bớt sub_zones).
   - Test `create_requisition`, `create_issue`, `create_tool_borrowing`, `create_fuel_dispense` lưu đúng `sub_zone_id`.
   - Test helper `formatZoneName` với các trường hợp dữ liệu.
   - Test component hiển thị danh sách, dialog và form chọn 2 cấp Khu - Trại.
2. **End-to-end Verification:**
   - Chạy `pnpm test` đảm bảo 100% tests pass xanh.
   - Chạy `pnpm typecheck` và `pnpm build` không có lỗi.
   - Kiểm tra trực tiếp trên giao diện: Tạo Khu 1 có Trại 1, 2, 3 -> Tạo phiếu yêu cầu chọn Khu 1 - Trại 1 -> Xem chi tiết phiếu & in PDF thấy `Khu 1 - Trại 1`.
