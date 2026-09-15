# Changelog
Tất cả các thay đổi quan trọng của dự án **MTP Farm ERP (Minh Tân Phát Supply)** sẽ được ghi nhận và lưu trữ trong tài liệu này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/), và tuân thủ [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
### Added (Kế hoạch mở rộng Poultry ERP)
- **Giai đoạn 1 — Sản lượng & Đàn gà:** Quản lý lứa gà theo từng dãy chuồng, theo dõi tỷ lệ đẻ `% Laying Rate`, phân loại trứng và xuất bán trứng thương phẩm.
- **Giai đoạn 2 — Thức ăn & Thú y:** Định mức tiêu thụ cám (g/con/ngày), tính hệ số chuyển hóa `FCR`, cảnh báo ăn giảm sớm, lịch vắc-xin tự động.
- **Giai đoạn 3 — Tài chính Nông trại:** Báo cáo Giá thành sản xuất 1 quả trứng (`Cost per Egg`), Báo cáo Lãi/Lỗ ròng (P&L) toàn trại.

---

## [0.9.0] - 2026-09-12
### Added
- **Quy đổi Đơn vị Tính & Đóng gói Đa cấp:** Hỗ trợ sản phẩm có nhiều cấp đơn vị (Thùng, Hộp, ml, Can, Lít, Bao, Kg) với hệ số `conversion_factor` linh hoạt.
- Cho phép nhân viên chuồng tùy ý chọn đơn vị xin cấp phát trên giỏ hàng, hệ thống tự động quy đổi về đơn vị cơ sở để trừ kho chính xác.
- **Migration 0068 (`post_receipt_require_manager_approval`):** Siết chặt quy trình nhập kho: Chỉ tự động xuất cấp phát (Auto-fulfill FIFO) cho các phiếu yêu cầu **ĐÃ ĐƯỢC PHÊ DUYỆT (`approved`)**, không tự động duyệt phiếu đang chờ (`pending`).
- Tái cấu trúc toàn bộ hệ thống tài liệu theo tiêu chuẩn quốc tế **Diátaxis Framework** tại `docs/`.

### Changed
- Nâng cấp toàn bộ 349 bài kiểm thử tự động (61 test suites) đạt chuẩn 100% pass.

---

## [0.8.0] - 2026-09-10
### Added
- **Hệ thống 7 Vai trò Chuẩn hóa (RBAC):** `superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester`, `driver`.
- **Bất biến định danh (Immutable Identity):** PostgreSQL Trigger `trg_profiles_prevent_identity_change` khóa cố định Họ tên và Tên đăng nhập sau khi tạo.
- **Cơ chế Hybrid Archive & Force Purge:**
  - Xóa vĩnh viễn tài khoản chưa từng phát sinh chứng từ.
  - Tự động chuyển sang Lưu trữ / Nghỉ việc (`is_active = false`) với tài khoản đã có lịch sử phiếu.
  - Phân tách 2 tab *"Đang làm việc"* và *"Đã nghỉ việc / Lưu trữ"* kèm nút *"Kích hoạt lại"* một chạm.
  - Đặc quyền `Force Purge` (`admin_purge_user_data`) dành riêng cho `superuser` để dọn dẹp môi trường test.
- **Quản lý Dãy chuồng 2 cấp (`sub_zones`):** Phân bổ chi phí và thống kê vật tư chính xác đến từng dãy chuồng.

---

## [0.7.0] - 2026-09-08
### Added
- **Phân hệ Trạm Bồn Dầu & Xe Cơ Giới (`/fuel`, `/fuel/scan`):** Quét mã QR 5 giây dán trên cabin xe, nhập số ODO/giờ máy, tự động tính định mức $L/100km$ hoặc $L/h$ và cảnh báo tiêu hao bất thường.
- **Phân hệ Mượn - Trả Dụng Cụ Đồ Nghề (`/tools`):** Quản lý tủ đồ nghề dùng chung, theo dõi hạn trả và cảnh báo quá hạn mượn.
- **Trung Tâm Báo Cáo & Phân Tích (`/reports`):** Thẻ kho (Stock Card), Báo cáo XNT, Chi phí vật tư theo từng dãy chuồng (`Zone Costing`), Xuất file Excel chuẩn kế toán.

---

## [0.6.0] - 2026-09-06
### Added
- **Đổi 1-1 Cấp Tốc trong 30 Giây (`/defects`):** Xử lý sự cố cháy motor quạt/máy bơm chuồng gà, xuất ngay hàng mới cứu đàn gà và nạp hàng cũ vào kho hỏng trong 1 transaction duy nhất.
- **Tách biệt Sửa chữa (`/repairs`) & Thanh lý phế liệu (`/liquidations`):** Gom motor đi quấn lại dây đồng, nghiệm thu đưa về kho tổng hoặc thanh lý ve chai thu hồi vốn.
- **Mẫu in PDF Vector Chuẩn Nhận Diện:** Tích hợp `@react-pdf/renderer`, nhúng font tiếng Việt `Be Vietnam Pro`, logo Trại gà Lê Văn Dương và mã QR tra cứu trực tiếp trên phiếu.

---

## [0.5.0] - 2026-09-05
### Added
- **Đăng nhập bằng Tên đăng nhập (Username Login):** Nhân viên không cần email cá nhân, đăng nhập trực tiếp bằng username và mật khẩu.
- **Trả lại Vật tư Thừa (`requisition_returns`):** Cho phép công nhân trả lại linh kiện thừa sau khi sửa chuồng xong, tự động cộng lại tồn kho.
- **Tách biệt Môi trường Dev & Prod:** Chạy Dev trên cổng 3001 (`.next-dev`) và Web chính Production trên cổng 3000 (`.next`) qua systemd `mtp-web`.

---

## [0.1.0] - 2026-09-01
### Added
- Khởi tạo dự án Next.js 15 App Router, TypeScript Strict, Tailwind CSS, Supabase PostgreSQL 17 + Row Level Security (RLS).
- Phân hệ Danh mục sản phẩm, Biến thể, Đa vị trí kho (`stock_locations`), Sổ cái biến động kho (`stock_movements`).
- Phiếu nhập kho từ Nhà cung cấp và Phiếu xuất kho nội bộ cơ bản.