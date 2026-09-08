# Phân hệ Quản lý Kho Dầu (Fuel Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng phân hệ Quản lý Kho Dầu chuyên biệt bao gồm: Quản lý Xuất-Nhập-Tồn nhiên liệu (Dầu DO, Dầu thủy lực, Nhớt, Xăng), Quản lý Phương tiện/Xe & In tem QR dán xe, Trang Quét mã QR cấp dầu siêu tốc theo Odo/Giờ máy, Mẫu in phiếu chuẩn và Báo cáo tiêu hao nhiên liệu theo xe & khu vực.

**Architecture:** Sử dụng kiến trúc module độc lập cho nhiên liệu: Cơ sở dữ liệu Supabase Postgres với các bảng `fuel_types`, `vehicles`, `fuel_receipts`, `fuel_dispenses`, `fuel_movements` kèm Stored Procedures / RPCs đảm bảo tính toàn vẹn Transaction; Phía UI xây dựng các Server Actions, TanStack Query, React Hook Form + Zod, Component Camera Scanner và chuẩn in PDF `StandardSlip`.

**Tech Stack:** Next.js 15 (App Router, Turbopack), React 19, TypeScript, Supabase (PostgreSQL, RLS, RPCs), Tailwind CSS v4, Radix UI / Shadcn UI, TanStack React Query, @react-pdf/renderer, qrcode, xlsx, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-fuel-management-design.md`

## Global Constraints

- Mọi thao tác cộng/trừ tồn kho dầu phải thực hiện qua PostgreSQL RPC có Transaction để chống Race Condition.
- Hỗ trợ số thập phân cho nhiên liệu (đo lường chính xác đến 2 chữ số thập phân, vd `150.75` lít).
- Mọi phiếu in PDF phải tuân thủ chuẩn thương hiệu "TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG" theo `StandardSlip`.
- Giao diện quét mã QR `/fuel/scan` phải tối ưu mobile-first, load tức thì và phản hồi trong dưới 1 giây.

---

### Task 1: Database Migration & Schema Setup

**Files:**
- Create: `supabase/migrations/0060_fuel_management.sql`
- Modify: `src/types/database.types.ts`
- Test: `src/test/fuel-db.test.ts`

**Interfaces:**
- Produces:
  - Tables: `fuel_types`, `vehicles`, `fuel_receipts`, `fuel_dispenses`, `fuel_movements`
  - RPCs: `create_fuel_receipt`, `create_fuel_dispense`, `cancel_fuel_dispense`, `cancel_fuel_receipt`, `get_vehicle_by_qr`

- [ ] **Step 1: Write SQL Migration File**

Tạo file migration `supabase/migrations/0060_fuel_management.sql` với đầy đủ:
1. Enums: `vehicle_type`, `fuel_calc_unit`, `fuel_movement_type`.
2. Tables: `fuel_types`, `vehicles`, `fuel_receipts`, `fuel_dispenses`, `fuel_movements`.
3. Triggers tự động cập nhật `updated_at`.
4. Sequences & hàm sinh mã phiếu `NKD-YYYYMMDD-XXXX` và `CKD-YYYYMMDD-XXXX`.
5. Stored Procedures / RPCs: `create_fuel_receipt`, `create_fuel_dispense`, `cancel_fuel_dispense`, `cancel_fuel_receipt`.
6. RLS Policies: Cho phép `authenticated` đọc, `manager`/`superuser` thêm/sửa/hủy.
7. Seed dữ liệu mẫu ban đầu: 4 loại dầu (Dầu DO 0.05S, Dầu thủy lực 68, Nhớt động cơ 15W40, Xăng RON 95) và một số xe mẫu.

- [ ] **Step 2: Apply Migration to Local / Dev Database**

Run: `pnpm exec supabase db reset` hoặc chạy script migration qua database connection.

- [ ] **Step 3: Update TypeScript Database Types**

Cập nhật `src/types/database.types.ts` bổ sung các định nghĩa kiểu TypeScript cho `fuel_types`, `vehicles`, `fuel_receipts`, `fuel_dispenses`, `fuel_movements` và các RPCs mới.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0060_fuel_management.sql src/types/database.types.ts
git commit -m "feat(db): add fuel management migration and typescript types"
```

---

### Task 2: Core Domain Logic & Calculation Utilities (TDD)

**Files:**
- Create: `src/lib/fuel.ts`
- Create: `src/lib/fuel.test.ts`

**Interfaces:**
- Produces:
  - `calcUsageDiff(current: number, previous?: number | null): number`
  - `calcConsumptionRate(quantity: number, usageDiff: number, unit: 'km' | 'hours'): number | null`
  - `formatFuelLiters(liters: number): string`
  - `formatOdo(odo: number, unit: 'km' | 'hours'): string`
  - `formatConsumptionRate(rate: number | null, unit: 'km' | 'hours'): string`
  - `generateVehicleQrToken(code: string): string`
  - `parseVehicleQrToken(qrText: string): { type: 'vehicle' | 'slip' | 'unknown'; value: string }`

- [ ] **Step 1: Write the failing tests**

Viết các test cases trong `src/lib/fuel.test.ts` kiểm tra các trường hợp:
- Tính chênh lệch Odo khi có Odo cũ và Odo mới hợp lệ.
- Tính chênh lệch Odo khi Odo mới < Odo cũ (trả về 0 hoặc ném cảnh báo).
- Tính định mức Lít/100km và Lít/giờ.
- Định dạng hiển thị số lít và tỷ lệ tiêu hao.
- Phân tích và sinh mã token QR xe / QR phiếu.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/fuel.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/lib/fuel.ts`**

Viết code hoàn chỉnh cho `src/lib/fuel.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/fuel.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add src/lib/fuel.ts src/lib/fuel.test.ts
git commit -m "feat(fuel): add fuel domain calculations and unit tests"
```

---

### Task 3: Schemas & Server Actions for Fuel and Vehicles

**Files:**
- Create: `src/features/fuel/schema.ts`
- Create: `src/features/fuel/actions.ts`
- Create: `src/features/vehicles/schema.ts`
- Create: `src/features/vehicles/actions.ts`
- Create: `src/features/fuel/types.ts`
- Create: `src/features/vehicles/types.ts`

**Interfaces:**
- Produces:
  - Schemas: `fuelReceiptSchema`, `fuelDispenseSchema`, `vehicleSchema`
  - Actions:
    - `getFuelOverview()`
    - `getFuelTypes()`
    - `getFuelReceipts()`
    - `createFuelReceiptAction()`
    - `getFuelDispenses()`
    - `createFuelDispenseAction()`
    - `getVehicleByQrAction()`
    - `getVehicles()`
    - `createVehicleAction()`
    - `updateVehicleAction()`
    - `toggleVehicleActiveAction()`
    - `getFuelReportData()`

- [ ] **Step 1: Create Schemas & Types**

Viết `src/features/fuel/types.ts`, `src/features/fuel/schema.ts`, `src/features/vehicles/types.ts`, `src/features/vehicles/schema.ts` với validation Zod chặt chẽ.

- [ ] **Step 2: Implement Server Actions**

Viết các hàm trong `src/features/fuel/actions.ts` và `src/features/vehicles/actions.ts` kết nối với Supabase client/RPC, xử lý xác thực quyền, bắt lỗi và trả về dữ liệu chuẩn.

- [ ] **Step 3: Run Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/fuel/ src/features/vehicles/
git commit -m "feat(fuel): add server actions and schemas for fuel and vehicles"
```

---

### Task 4: Navigation & App Shell Updates

**Files:**
- Modify: `src/lib/nav.ts`
- Modify: `src/lib/nav.test.ts` (nếu có)
- Modify: `src/components/layout/sidebar.tsx`

**Interfaces:**
- Produces:
  - Tab "Kho dầu" (`/fuel`, icon `Fuel` từ `lucide-react`) trong `MAIN_NAV`.
  - Tab "Phương tiện / Xe" (`/admin/vehicles`, icon `Truck` từ `lucide-react`) trong `ADMIN_NAV`.

- [ ] **Step 1: Update `src/lib/nav.ts`**

Thêm `Fuel` và `Truck` icon vào danh mục điều hướng.

- [ ] **Step 2: Verify nav resolution and titles**

Kiểm tra hàm `findTitle("/fuel")` trả về `"Kho dầu"` và `findTitle("/admin/vehicles")` trả về `"Phương tiện / Xe"`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/nav.ts
git commit -m "feat(nav): add fuel management and vehicles navigation items"
```

---

### Task 5: Admin Vehicles Management & QR Printing

**Files:**
- Create: `src/app/(app)/admin/vehicles/page.tsx`
- Create: `src/features/admin/components/vehicle-list.tsx`
- Create: `src/features/admin/components/vehicle-dialog.tsx`
- Create: `src/features/admin/components/vehicle-qr-modal.tsx`
- Create: `src/features/pdf/vehicle-qr-label.tsx`
- Create: `src/app/api/vehicles/[id]/qr/route.ts`

**Interfaces:**
- Produces:
  - Trang CRUD quản lý phương tiện/thiết bị tại `/admin/vehicles`.
  - Dialog tạo/sửa xe với chọn loại máy, khu vực, tài xế, loại dầu mặc định, định mức.
  - Dialog in tem QR dán xe (in tem đơn lẻ hoặc in bảng nhiều tem A4).

- [ ] **Step 1: Create Vehicle QR PDF Label Component**

Tạo `src/features/pdf/vehicle-qr-label.tsx` sử dụng `@react-pdf/renderer` và thư viện `qrcode` để tạo mẫu tem dán xe chất lượng cao với Logo, Tên trại, Biển số xe to rõ và Mã QR.

- [ ] **Step 2: Create Vehicle Management Components**

Xây dựng `vehicle-list.tsx`, `vehicle-dialog.tsx`, `vehicle-qr-modal.tsx`.

- [ ] **Step 3: Create Page Route `/admin/vehicles`**

Tạo `src/app/(app)/admin/vehicles/page.tsx` tích hợp đầy đủ danh sách, tìm kiếm, lọc theo loại xe, nút thêm xe và nút in tem QR.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/admin/vehicles/ src/features/admin/components/vehicle-* src/features/pdf/vehicle-qr-label.tsx
git commit -m "feat(admin): implement vehicle management and qr decal printing"
```

---

### Task 6: Fuel Management Overview, Dispenses, Receipts & Reports

**Files:**
- Create: `src/app/(app)/fuel/page.tsx`
- Create: `src/app/(app)/fuel/layout.tsx`
- Create: `src/features/fuel/components/fuel-overview.tsx`
- Create: `src/features/fuel/components/fuel-dispense-list.tsx`
- Create: `src/features/fuel/components/fuel-dispense-dialog.tsx`
- Create: `src/features/fuel/components/fuel-receipt-list.tsx`
- Create: `src/features/fuel/components/fuel-receipt-dialog.tsx`
- Create: `src/features/fuel/components/fuel-reports.tsx`

**Interfaces:**
- Produces:
  - Tab 1: Tổng quan tồn kho dầu thời gian thực + biểu đồ tiêu thụ theo khu vực/xe.
  - Tab 2: Danh sách cấp phát dầu (Xuất kho) + Form cấp phát thủ công.
  - Tab 3: Danh sách nhập kho dầu + Form nhập dầu NCC đính kèm hóa đơn.
  - Tab 4: Báo cáo chi tiết định mức tiêu hao từng xe (L/100km, L/h) và xuất Excel.

- [ ] **Step 1: Implement Fuel Layout & Tabs**

Tạo `src/app/(app)/fuel/layout.tsx` và `src/app/(app)/fuel/page.tsx` với Tab switcher: `Tổng quan`, `Cấp phát dầu`, `Nhập kho`, `Báo cáo`.

- [ ] **Step 2: Implement Overview Tab**

Tạo `src/features/fuel/components/fuel-overview.tsx` hiển thị thẻ tồn kho thực tế các loại dầu, tỷ lệ an toàn, tổng cấp/nhập và biểu đồ phân bổ.

- [ ] **Step 3: Implement Dispenses Tab & Dialog**

Tạo `src/features/fuel/components/fuel-dispense-list.tsx` và `fuel-dispense-dialog.tsx`.

- [ ] **Step 4: Implement Receipts Tab & Dialog**

Tạo `src/features/fuel/components/fuel-receipt-list.tsx` và `fuel-receipt-dialog.tsx`.

- [ ] **Step 5: Implement Reports Tab & Excel Export**

Tạo `src/features/fuel/components/fuel-reports.tsx` tính toán hiệu suất tiêu hao thực tế so với định mức và xuất file `.xlsx`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/fuel/ src/features/fuel/components/
git commit -m "feat(fuel): implement fuel tabs for overview, dispenses, receipts and reports"
```

---

### Task 7: Quick QR Scanner for Fuel Dispensing (`/fuel/scan`)

**Files:**
- Create: `src/app/(app)/fuel/scan/page.tsx`
- Create: `src/features/fuel/components/fuel-quick-scan.tsx`
- Create: `src/features/fuel/components/qr-camera-scanner.tsx`

**Interfaces:**
- Produces:
  - Giao diện quét mã QR bằng Camera điện thoại hoặc nhập nhanh biển số.
  - Tự động nhận diện xe, tài xế, Odo lần trước.
  - Form xác nhận cấp dầu 1 bước (Số lít, Odo mới, Tài xế, Ảnh đồng hồ).

- [ ] **Step 1: Implement Camera QR Scanner Component**

Tạo `src/features/fuel/components/qr-camera-scanner.tsx` tích hợp xử lý stream camera hoặc thư viện quét mã QR ổn định trên mobile.

- [ ] **Step 2: Implement Quick Scan Dispense Workflow**

Tạo `src/features/fuel/components/fuel-quick-scan.tsx` xử lý luồng: Quét mã -> Tải thông tin xe -> Nhập số lít và Odo mới -> Tính ngay quãng đường/giờ chạy chênh lệch -> Bấm Xác nhận Cấp dầu -> Lưu thành công và sẵn sàng quét xe kế tiếp.

- [ ] **Step 3: Create Route `/fuel/scan`**

Tạo `src/app/(app)/fuel/scan/page.tsx` tích hợp nút quay lại Kho Dầu và tối ưu toàn màn hình cho thiết bị di động.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/fuel/scan/ src/features/fuel/components/*scan*
git commit -m "feat(fuel): implement mobile quick qr scanner for fuel dispensing"
```

---

### Task 8: Standard PDF Slips for Fuel (Receipts & Dispenses)

**Files:**
- Modify: `src/features/pdf/standards.ts`
- Create: `src/app/api/fuel/receipts/[id]/pdf/route.tsx`
- Create: `src/app/api/fuel/dispenses/[id]/pdf/route.tsx`

**Interfaces:**
- Produces:
  - Mẫu in Phiếu Nhập Kho Dầu chuẩn thương hiệu Trại Lê Văn Dương.
  - Mẫu in Phiếu Cấp Phát Dầu chuẩn thương hiệu với thông tin xe, odo, tài xế và 4 chữ ký.

- [ ] **Step 1: Add Fuel Slip Standards Configuration**

Cập nhật `src/features/pdf/standards.ts` bổ sung `fuelReceiptStandard` và `fuelDispenseStandard`.

- [ ] **Step 2: Create PDF API Routes**

Tạo `src/app/api/fuel/receipts/[id]/pdf/route.tsx` và `src/app/api/fuel/dispenses/[id]/pdf/route.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/pdf/standards.ts src/app/api/fuel/
git commit -m "feat(pdf): add standard slips for fuel receipts and dispenses"
```

---

### Task 9: Verification, Tests & Final Polishing

**Files:**
- Test files: `src/lib/fuel.test.ts`, `src/features/fuel/**/*.test.ts`
- Modify: Any files needing polish

- [ ] **Step 1: Run Full Vitest Test Suite**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Run Full TypeScript Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Run Next.js Build**

Run: `pnpm build`
Expected: Build thành công không có lỗi lint hoặc typescript.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(fuel): complete fuel management subsystem implementation and verification"
```
