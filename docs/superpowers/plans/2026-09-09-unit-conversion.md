# Kế hoạch Triển khai: Phân hệ Quy đổi Đơn vị & Đóng gói Đa cấp cho Vật tư (Unit Conversion)

> **Mục tiêu:** Bổ sung tính năng tạo vật tư có quy đổi đơn vị đa cấp (Thùng, Hộp, ml, Bao, Kg, Can, Lít), hỗ trợ người yêu cầu tùy chọn đơn vị cấp phát, tự động quy đổi và trừ tồn kho chính xác theo sổ cái.  
> **Tài liệu đặc tả:** docs/superpowers/specs/2026-09-09-unit-conversion-design.md  
> **TDD Route:** Light / Post-change regression (Vitest)  
> **Trạng thái:** Đã hoàn thành 100% (5/5 Tasks Completed)  

---

## 1. Danh sách các File Thay đổi & File Mới

| STT | File Path | Mục đích / Trách nhiệm |
|:---:|:---|:---|
| 1 | docs/superpowers/specs/2026-09-09-unit-conversion-design.md | Tài liệu đặc tả kỹ thuật chi tiết toàn diện |
| 2 | docs/superpowers/plans/2026-09-09-unit-conversion.md | Tài liệu kế hoạch triển khai chi tiết |
| 3 | src/features/products/schema.ts | Schema validation Zod cho unitConversionInputSchema |
| 4 | src/features/products/actions.ts | Server actions xử lý insert variants và liên kết variant_components |
| 5 | src/features/products/components/product-form-dialog.tsx | Nâng cấp Modal Tạo vật tư với mode quy-doi |
| 6 | src/features/products/components/product-variants-dialog.tsx | Cải tiến quản lý biến thể hiển thị công thức quy đổi |
| 7 | src/features/products/components/product-detail-dialog.tsx | Hỗ trợ chọn đơn vị đặt hàng và hiển thị ghi chú quy đổi thông minh |
| 8 | src/lib/attributes.ts & src/lib/attributes.test.ts | Helper định dạng nhãn quy đổi kitLabel |
| 9 | src/features/products/schema.test.ts | Unit test cho Zod schema quy đổi đơn vị |
| 10 | src/features/products/components/product-detail-dialog.test.tsx | Unit test cho UI chọn đơn vị quy đổi |

---

## 2. Chi tiết 5 Bước Thực hiện (Execution Slices)

### Task 1: Cập nhật Schema & Helper Định dạng Nhãn Quy đổi
- **Nội dung:**
  - Thêm unitConversionInputSchema và conversionItemInputSchema trong src/features/products/schema.ts.
  - Cập nhật kitLabel trong src/lib/attributes.ts để hiển thị format thân thiện cho dòng quy đổi đơn vị ("Thùng = 6 Hộp (550ml)").
  - Cập nhật test cases trong src/lib/attributes.test.ts.
- **Kết quả:** Pass 7/7 tests.

### Task 2: Cập nhật Server Actions createProduct
- **Nội dung:**
  - Trong src/features/products/actions.ts, khi nhận payload có unitConversion:
    - Tạo biến thể cơ sở (Base Variant) tại index 0.
    - Tạo các biến thể quy đổi (Package Variants) tại index 1..N.
    - Tự động insert vào variant_components với parent_variant_id = parent.id, child_variant_id = base.id, quantity = factor.
- **Kết quả:** Đảm bảo toàn vẹn dữ liệu quan hệ cha-con.

### Task 3: Nâng cấp Modal Tạo vật tư (ProductFormDialog.tsx)
- **Nội dung:**
  - Bổ sung mode quy-doi vào MODE_OPTIONS.
  - Thiết kế 2 khối: Khối Đơn vị cơ sở (Tên ĐVT, Quy cách, Giá lẻ, Tồn min, Theo lô) và Khối Đơn vị đóng gói quy đổi (Tên ĐVT lớn, Tỷ lệ, Giá theo thùng, Ghi chú).
  - Hỗ trợ thêm nhiều cấp đóng gói (+ Thêm cấp đóng gói).
  - Xem trước Live Preview công thức quy đổi.
- **Kết quả:** Giao diện trực quan, dễ dùng cho quản lý kho.

### Task 4: Nâng cấp Quản lý Biến thể & Chi tiết Vật tư
- **Nội dung:**
  - ProductVariantsDialog.tsx: Hiển thị nhãn công thức quy đổi khi xem chi tiết biến thể.
  - ProductDetailDialog.tsx: Cho phép người dùng chuyển đổi radio giữa các đơn vị tính, hiển thị tồn kho khả dụng tương ứng và dòng ghi chú quy đổi tức thì ("💡 Quy đổi: 2 Thùng = 12 Hộp").
- **Kết quả:** Trải nghiệm đặt hàng linh hoạt và minh bạch.

### Task 5: Viết Unit Tests & Chạy Test Suite Toàn hệ thống
- **Nội dung:**
  - Viết src/features/products/schema.test.ts và src/features/products/components/product-detail-dialog.test.tsx.
  - Chạy pnpm vitest run cho toàn bộ test suite dự án.
- **Kết quả:** Toàn bộ 61 test files / 349 tests đều PASS 100%.
