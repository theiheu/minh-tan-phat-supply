# 📋 KẾ HOẠCH TRIỂN KHAI: DASHBOARD CHUYÊN BIỆT THEO VAI TRÒ NGƯỜI DÙNG

**Mã tài liệu:** `PLAN-2026-09-20-ROLE-TAILORED-DASHBOARD`  
**Đặc tả gốc:** `docs/aegis/specs/2026-09-20-role-tailored-dashboard-design.md`  
**Ngày lập:** 2026-09-20  
**Trạng thái:** Sẵn sàng thực thi (Ready for Execution)  

---

## 1. THÔNG TIN ĐIỀU HÀNH & KIẾN TRÚC (PLAN HEADER)

* **Mục tiêu:** Thiết kế lại toàn bộ trang chủ Dashboard (`/dashboard`) hiển thị chuyên biệt cho 7 vai trò người dùng (Chủ trại, Superuser, Kế toán, Thủ kho, Kỹ thuật trưởng, Công nhân chuồng, Tài xế).
* **Công nghệ & Thư viện:** Next.js 15 (App Router, Server Components), TypeScript, Tailwind CSS, Lucide Icons, Shadcn UI, Supabase Server Client, Vitest.
* **Tài liệu tham chiếu chuẩn:**
  * `docs/architecture/rbac-and-roles.md`
  * `docs/architecture/database-schema.md`
  * `src/lib/types.ts`
  * `src/lib/nav.ts`
* **Ranh giới tương thích (Compatibility Boundary):**
  * Giữ nguyên 100% logic nghiệp vụ của các trang chi tiết (`/requisitions`, `/receipts`, `/issues`, `/defects`, `/fuel`, `/tools`, `/stocktake`).
  * Giữ nguyên cơ chế mở Modal xem nhanh chứng từ (`useUIStore.openSlipModal`).
* **TDD Route:**
  ```text
  TDD Route:
  - Mode: auto
  - Decision: light
  - Strict authority: not applicable
  - Strict signals: none (UI Dashboard views and server loaders)
  - Light eligibility: additive UI components and server loaders verified via component and smoke tests
  - Test posture: post-change regression & component testing
  - Verification: bun test or vitest run
  ```

---

## 2. DANH MỤC CÁC TỆP THAY ĐỔI (FILE MAP)

### Tệp tạo mới:
1. `src/components/dashboard/shared/dashboard-quick-actions.tsx` — Thanh phím tắt tác vụ nhanh
2. `src/components/dashboard/shared/dashboard-metric-card.tsx` — Thẻ KPI/Metric hiển thị số liệu
3. `src/components/dashboard/shared/pending-tasks-card.tsx` — Thẻ danh sách việc cần xử lý hành động
4. `src/components/dashboard/shared/low-stock-alert-card.tsx` — Thẻ cảnh báo tồn kho tối thiểu
5. `src/components/dashboard/views/executive-dashboard-view.tsx` — Khung nhìn Chủ trại / Superuser
6. `src/components/dashboard/views/accountant-dashboard-view.tsx` — Khung nhìn Kế toán
7. `src/components/dashboard/views/warehouse-dashboard-view.tsx` — Khung nhìn Thủ kho
8. `src/components/dashboard/views/technician-dashboard-view.tsx` — Khung nhìn Kỹ thuật trưởng
9. `src/components/dashboard/views/requester-dashboard-view.tsx` — Khung nhìn Công nhân chuồng
10. `src/components/dashboard/views/driver-dashboard-view.tsx` — Khung nhìn Tài xế xe
11. `src/features/dashboard/server/get-role-dashboard-data.ts` — Module tải dữ liệu Supabase theo role
12. `src/components/dashboard/dashboard-role-views.test.tsx` — Unit/Component tests cho các view

### Tệp cập nhật:
1. `src/app/(app)/dashboard/page.tsx` — Tải dữ liệu theo role và phân phối view
2. `src/app/(app)/dashboard/loading.tsx` — Skeleton loading cập nhật cho trang dashboard mới

---

## 3. CÁC TÁC VỤ THỰC THI CHI TIẾT (ATOMIC TASKS)

---

### 🟢 Task 1: Xây dựng Bộ Widget UI dùng chung (Shared Dashboard Widgets)
* **Tệp:**
  * Tạo `src/components/dashboard/shared/dashboard-quick-actions.tsx`
  * Tạo `src/components/dashboard/shared/dashboard-metric-card.tsx`
  * Tạo `src/components/dashboard/shared/pending-tasks-card.tsx`
  * Tạo `src/components/dashboard/shared/low-stock-alert-card.tsx`
* **Mục tiêu:** Tạo các component giao diện chuẩn hóa, hiển thị đẹp mắt, hỗ trợ responsive di động và tương tác mượt mà.
* **Xác minh:** Kiểm tra component biên dịch không lỗi TypeScript.

---

### 🟢 Task 2: Xây dựng Module Server Data Loaders theo vai trò
* **Tệp:**
  * Tạo `src/features/dashboard/server/get-role-dashboard-data.ts`
* **Mục tiêu:**
  * Viết các hàm query tối ưu hóa song song bằng `Promise.all`:
    * `getExecutiveDashboardData(supabase)`
    * `getAccountantDashboardData(supabase)`
    * `getWarehouseDashboardData(supabase)`
    * `getTechnicianDashboardData(supabase, profile)`
    * `getRequesterDashboardData(supabase, profile)`
    * `getDriverDashboardData(supabase, profile)`
  * Khai báo kiểu TypeScript chặt chẽ cho dữ liệu đầu ra của từng loader.
* **Xác minh:** Kiểm tra typecheck `bun run check` hoặc `tsc --noEmit`.

---

### 🟢 Task 3: Xây dựng 6 Khung nhìn Dashboard chuyên biệt (Role Dashboard Views)
* **Tệp:**
  * Tạo `src/components/dashboard/views/executive-dashboard-view.tsx`
  * Tạo `src/components/dashboard/views/accountant-dashboard-view.tsx`
  * Tạo `src/components/dashboard/views/warehouse-dashboard-view.tsx`
  * Tạo `src/components/dashboard/views/technician-dashboard-view.tsx`
  * Tạo `src/components/dashboard/views/requester-dashboard-view.tsx`
  * Tạo `src/components/dashboard/views/driver-dashboard-view.tsx`
* **Mục tiêu:**
  * Ghép nối các Widget dùng chung thành bố cục hoàn chỉnh cho từng vai trò theo đặc tả Spec.
  * Tích hợp Modal xem chi tiết phiếu (`StatDetailDialog` hoặc `openSlipModal`).
* **Xác minh:** Kiểm tra giao diện hiển thị đúng các trường dữ liệu và nút bấm.

---

### 🟢 Task 4: Cập nhật Router Entry Point & Loading State
* **Tệp:**
  * Sửa `src/app/(app)/dashboard/page.tsx`
  * Sửa `src/app/(app)/dashboard/loading.tsx`
* **Mục tiêu:**
  * `page.tsx` lấy `profile` từ `requireProfile()`, gọi loader tương ứng theo `profile.role` và trả về View thích hợp.
  * `loading.tsx` hiển thị skeleton loader hiện đại tương thích với layout dashboard mới.
* **Xác minh:** Chạy thử trang Dashboard không có lỗi runtime.

---

### 🟢 Task 5: Viết Test Suite và Kiểm thử toàn diện
* **Tệp:**
  * Tạo `src/components/dashboard/dashboard-role-views.test.tsx`
* **Mục tiêu:**
  * Viết test cases kiểm thử việc render của cả 6 Role Dashboard Views với mock data.
  * Kiểm thử các nút bấm Quick Action và click chi tiết.
* **Lệnh xác minh:**
  ```bash
  bun x vitest run src/components/dashboard/dashboard-role-views.test.tsx
  ```

---

### 🟢 Task 6: Kiểm tra Typecheck & Build dự án
* **Mục tiêu:** Đảm bảo toàn bộ dự án không có lỗi type hoặc compile error.
* **Lệnh xác minh:**
  ```bash
  bun run build
  ```

---

## 4. QUẢN TRỊ RỦI RO & PHỤC HỒI (RISK & ROLLBACK)
* **Rủi ro:** Một số tài khoản cũ có thể có `role` chưa chuẩn hóa hoặc `null`.
* **Biện pháp:** Luôn có nhánh `default` trong `switch (profile.role)` chuyển về `RequesterDashboardView` hoặc `ExecutiveDashboardView` an toàn, không làm crash trang web.
