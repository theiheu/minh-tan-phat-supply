# Kế hoạch Triển khai: Quản lý Trại/Xưởng Trực thuộc Khu vực (Sub-zones Management)

- **Mục tiêu:** Thêm phân cấp Trại / Xưởng trực thuộc Khu vực (VD: Khu 1 có Trại 1, 2, 3...; Khu 4 có Xưởng phân), quản lý trong tab Khu vực, và cho phép chọn Trại/Xưởng trong tất cả tính năng liên quan đến Khu vực (Phiếu yêu cầu, Xuất kho, Mượn đồ, Cấp dầu, Xe, Người dùng, PDF).
- **Kiến trúc:** Bảng `sub_zones` liên kết khoá ngoại với `zones`, các bảng nghiệp vụ liên kết `sub_zone_id`, RPCs nhận `p_sub_zone_id`, Server Actions đồng bộ, component chọn 2 cấp Khu - Trại, và helper `formatZoneLabel` định dạng `Khu 1 - Trại 1`.
- **Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL, RLS, RPCs), React 19, TypeScript, Tailwind CSS, Zod, Vitest.
- **Tài liệu tham chiếu:** `docs/superpowers/specs/2026-09-10-sub-zones-management-design.md`
- **TDD Route:** auto (post-change regression & focused unit tests)
- **Xác minh toàn diện:** `pnpm test`, `pnpm typecheck`, `pnpm build`.

---

## 1. Bản đồ File Thay đổi (File Map)

### Tạo mới:
1. `supabase/migrations/0062_sub_zones_management.sql` — Migration tạo bảng `sub_zones`, bổ sung cột `sub_zone_id`, cập nhật RPCs.
2. `src/features/admin/components/zone-manager.tsx` — Component quản lý danh sách Khu vực kèm Trại con và Dialog thêm/sửa Trại con linh hoạt.
3. `src/components/zone-sub-zone-select.tsx` — Component chọn Khu vực & Trại/Xưởng trực thuộc tái sử dụng cho các form.
4. `src/lib/format-zone.ts` & `src/lib/format-zone.test.ts` — Helper định dạng hiển thị `Khu 1 - Trại 1` và unit tests.
5. `src/features/admin/components/zone-manager.test.tsx` — Test giao diện và tương tác quản lý Trại/Xưởng.

### Chỉnh sửa:
1. `src/lib/types.ts` & `src/types/database.types.ts` — Thêm type `SubZone`, bổ sung `sub_zone_id`, `sub_zone` vào các kiểu dữ liệu liên quan.
2. `src/features/admin/actions.ts` — Bổ sung `saveZoneWithSubZones` để lưu Zone kèm mảng Trại con.
3. `src/app/(app)/admin/zones/page.tsx` — Sử dụng `ZoneManager` thay cho `EntityCrud` cơ bản.
4. `src/features/requisitions/schema.ts` & `actions.ts` — Thêm `subZoneId` vào schema và RPC call.
5. `src/features/requisitions/components/requisition-form.tsx` & `requisition-dialog.tsx` — Tích hợp chọn Trại/Xưởng con.
6. `src/app/(app)/requisitions/new/page.tsx` & `src/app/(app)/requisitions/page.tsx` & `src/app/(app)/requisitions/[id]/page.tsx` — Query `sub_zones` và hiển thị `Khu 1 - Trại 1`.
7. `src/features/issues/schema.ts`, `actions.ts`, `components/issue-form.tsx`, `components/issue-dialog.tsx`, `src/app/(app)/issues/[id]/page.tsx` — Thêm `subZoneId`.
8. `src/features/tools/schema.ts`, `actions.ts`, `components/tool-borrow-dialog.tsx`, `src/app/(app)/tools/page.tsx` — Thêm `subZoneId`.
9. `src/features/fuel/schema.ts`, `actions.ts`, `components/fuel-dispense-dialog.tsx`, `src/app/(app)/fuel/page.tsx` — Thêm `subZoneId`.
10. `src/features/vehicles/actions.ts`, `src/app/(app)/admin/vehicles/page.tsx` — Hỗ trợ `subZoneId` cho phương tiện.
11. `src/features/auth/schema.ts`, `actions/create-user.ts`, `actions/update-profile.ts`, `components/users-manager.tsx` — Hỗ trợ `subZoneId` mặc định cho user.
12. `src/components/slip-detail-modal.tsx`, `src/components/dashboard/recent-requisitions-card.tsx`, `src/components/dashboard/stat-detail-dialog.tsx` — Hiển thị `Khu 1 - Trại 1`.
13. `src/app/api/requisitions/[id]/pdf/route.tsx`, `src/app/api/issues/[id]/pdf/route.tsx`, `src/app/api/tools/[id]/pdf/route.tsx`, `src/app/api/fuel/dispenses/[id]/pdf/route.tsx`, `src/app/api/vehicles/[id]/qr/route.tsx` — In PDF hiển thị `Khu 1 - Trại 1`.
14. `src/features/reports/queries.ts`, `src/features/reports/lib/excel-export.ts` — Báo cáo xuất excel có đầy đủ tên Trại.
15. `scripts/seed-fake-materials.ts` — Khởi tạo mẫu các Trại cho Khu 1, Khu 2, Khu 3, Khu 4.

---

## 2. Các Bước Thực Hiện Chi Tiết (Bite-Sized Tasks)

### Task 1: Migration Cơ sở Dữ liệu & Cập nhật RPCs
- **File:** `supabase/migrations/0062_sub_zones_management.sql`
- **Mục tiêu:**
  - Tạo bảng `sub_zones` với RLS.
  - Bổ sung cột `sub_zone_id` vào `requisitions`, `issues`, `tool_borrowings`, `fuel_dispenses`, `vehicles`, `profiles`.
  - Cập nhật các RPC: `create_requisition`, `create_issue`, `create_tool_borrowing`, `create_fuel_dispense`, `admin_update_profile`, `list_requester_accounts`.
  - Chạy migration vào database local bằng `supabase db push` hoặc thực thi SQL.
- **Xác minh:** Kiểm tra bảng `sub_zones` tồn tại và các RPC nhận tham số `p_sub_zone_id` thành công.

### Task 2: Types, Helpers & Unit Tests
- **File:** `src/lib/types.ts`, `src/lib/format-zone.ts`, `src/lib/format-zone.test.ts`
- **Mục tiêu:**
  - Thêm type `SubZone`: `{ id: string; zone_id: string; name: string; description?: string | null; display_order?: number; deleted_at?: string | null }`.
  - Bổ sung `sub_zone_id`, `sub_zone` vào các kiểu liên quan trong `types.ts` và `database.types.ts`.
  - Viết helper `formatZoneLabel(zoneName, subZoneName)` trả về `Khu 1 - Trại 1` hoặc `Khu 1` hoặc `—`.
  - Viết unit tests cho `formatZoneLabel`.
- **Xác minh:** Chạy `pnpm test src/lib/format-zone.test.ts` pass 100%.

### Task 3: Quản trị Khu vực & Trại/Xưởng (`/admin/zones`)
- **File:** `src/features/admin/actions.ts`, `src/features/admin/components/zone-manager.tsx`, `src/app/(app)/admin/zones/page.tsx`, `src/features/admin/components/zone-manager.test.tsx`
- **Mục tiêu:**
  - Action `saveZoneWithSubZones(id, data: { name, description, subZones: string[] })` — Tạo/cập nhật zone và tự động tạo/giữ/soft-delete các sub_zones.
  - Xây dựng component `ZoneManager`:
    - Danh sách Khu: hiện Tên, Mô tả, Badges Trại con.
    - Dialog Thêm/Sửa: Ô nhập Tên, Mô tả, Quản lý Trại con (nhập tên bấm Enter hoặc bấm Thêm, danh sách badge có nút x xoá nhanh).
  - Viết test cho `ZoneManager`.
- **Xác minh:** Chạy `pnpm test src/features/admin/components/zone-manager.test.tsx` pass.

### Task 4: Component Chọn Khu & Trại Tái Sử Dụng (`ZoneSubZoneSelect`)
- **File:** `src/components/zone-sub-zone-select.tsx`
- **Mục tiêu:**
  - Xây dựng component nhận `zones: Zone[]`, `subZones: SubZone[]`, `zoneId: string`, `subZoneId: string`, `onZoneChange`, `onSubZoneChange`.
  - Tự động lọc danh sách Trại theo Khu được chọn. Nếu khu không có trại, ẩn hoặc làm mờ dropdown trại một cách mượt mà.
- **Xác minh:** Test render và tương tác chọn khu -> đổi danh sách trại.

### Task 5: Tích hợp vào Phân hệ Phiếu Yêu Cầu (Requisitions)
- **File:**
  - `src/features/requisitions/schema.ts` (thêm `subZoneId: z.string().uuid().optional().nullable()`)
  - `src/features/requisitions/actions.ts` (truyền `p_sub_zone_id` vào `create_requisition`)
  - `src/features/requisitions/components/requisition-form.tsx` & `requisition-dialog.tsx`
  - `src/app/(app)/requisitions/new/page.tsx` & `src/app/(app)/requisitions/page.tsx` & `src/app/(app)/requisitions/[id]/page.tsx`
  - `src/app/api/requisitions/[id]/pdf/route.tsx`
- **Mục tiêu:**
  - Query kèm `sub_zone:sub_zones!requisitions_sub_zone_id_fkey(name)`.
  - Cho phép chọn Trại/Xưởng khi tạo phiếu yêu cầu.
  - Hiển thị `Khu 1 - Trại 1` trên danh sách, chi tiết và mẫu in PDF.
- **Xác minh:** Chạy `pnpm test src/features/requisitions` pass.

### Task 6: Tích hợp vào Phiếu Xuất Kho, Mượn Dụng Cụ, Cấp Nhiên Liệu, Xe & Người Dùng
- **File:**
  - `src/features/issues/` (schema, actions, issue-form, issue-dialog, [id]/page, pdf)
  - `src/features/tools/` (schema, actions, tool-borrow-dialog, tools/page, pdf)
  - `src/features/fuel/` (schema, actions, fuel-dispense-dialog, fuel/page, pdf)
  - `src/features/vehicles/` & `src/app/(app)/admin/vehicles/page.tsx`, vehicle qr pdf
  - `src/features/auth/` (users-manager, create-user, update-profile)
  - `src/components/slip-detail-modal.tsx`, `src/components/dashboard/recent-requisitions-card.tsx`, `src/components/dashboard/stat-detail-dialog.tsx`
  - `src/features/reports/queries.ts`, `src/features/reports/lib/excel-export.ts`
- **Mục tiêu:**
  - Áp dụng chọn và hiển thị `Khu 1 - Trại 1` đồng bộ toàn diện trên tất cả các phân hệ.
- **Xác minh:** Chạy toàn bộ test suites của các phân hệ liên quan.

### Task 7: Cập nhật Seed Dữ liệu & Kiểm thử Tích hợp Toàn diện
- **File:** `scripts/seed-fake-materials.ts`
- **Mục tiêu:**
  - Cập nhật seed script tạo mẫu các Trại cho Khu 1 (Trại 1, Trại 2, Trại 3), Khu 2 (Trại 4, Trại 5, Trại 6), Khu 3 (Nhà ấp trứng, Xưởng cơ điện), Khu 4 (Xưởng phân, Trạm bơm).
  - Chạy `pnpm test` (đảm bảo 100% test files pass).
  - Chạy `pnpm typecheck` (tsc --noEmit không có lỗi).
  - Chạy `pnpm build` xác nhận đóng gói production thành công.
