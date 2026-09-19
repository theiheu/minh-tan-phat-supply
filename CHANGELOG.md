# Changelog

Ghi nhận các thay đổi quan trọng của dự án **Minh Tân Phát Supply**.  
Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/) + [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — Nâng cấp kiến trúc Catalog

### In Progress
- **SKU Catalog Architecture (migrations 0072–0086):** Thay thế toàn bộ mô hình Product/Variant cũ bằng mô hình `Product → SKU → UOM → Stock Ledger` chuẩn hóa.
  - Normalized attribute definitions, typed attribute values
  - Multi-level transaction UoM với document snapshots
  - Append-only Posting Kernel, idempotency, reversal
  - Lot/expiry/serial tracking policy
  - BOM versioning cho bộ vật tư ảo và bộ ráp sẵn
  - Catalog search tăng cường: unaccent tiếng Việt, multi-token, barcode, SKU code
- **AI Copilot draggable button:** floating button hỗ trợ drag cả touch và mouse

### Planned (Poultry ERP Phase 2+)
- Giai đoạn 1 — Sản lượng & Đàn gà: Quản lý lứa gà theo dãy trại, tỷ lệ đẻ `% Laying Rate`, phân loại trứng.
- Giai đoạn 2 — Thức ăn & Thú y: Định mức cám (g/con/ngày), FCR, lịch vắc-xin tự động.
- Giai đoạn 3 — Tài chính Nông trại: Chi phí/quả trứng, Báo cáo Lãi/Lỗ ròng (P&L).

---

## [0.10.0] - 2026-09-18

### Added
- **AI Copilot (floating, draggable):** Chat RAG nội bộ dựa trên dữ liệu kho thực tế. Tích hợp Omniroute RAG system, quản lý conversations và documents qua admin panel.
- **AI Admin Management (`/admin/ai-copilot`):** Upload tài liệu nội bộ vào knowledge base, quản lý conversations AI, theo dõi document chunks.
- **Additive SKU + Posting schema (migrations 0072–0086):** Chuẩn bị nền tảng cho catalog cutover. Schemas mới được additive, runtime cũ vẫn là chính cho đến cutover.
- **Multi-database backup:** Script backup pre-cutover tự động (`backups/database/`).
- **Catalog search cải tiến (0086):** Unaccent tiếng Việt, multi-token search (tên + thuộc tính), barcode, SKU code.
- **OG image, sitemap, robots.txt** cho SEO.
- **Assembly module (`/assemblies`):** UI lắp ráp bộ vật tư.

---

## [0.9.0] - 2026-09-12

### Added
- **Quy đổi Đơn vị Tính & Đóng gói Đa cấp:** Thùng, Hộp, ml, Can, Lít, Bao, Kg với hệ số `conversion_factor`. Giỏ hàng cho phép chọn đơn vị linh hoạt, hệ thống tự quy đổi về Base UOM.
- **Migration 0068 — Auto-fulfill chỉ cho phiếu đã duyệt:** Siết quy trình nhập kho — chỉ Auto-fulfill FIFO cho phiếu `approved`, bỏ qua `pending`.
- **Tái cấu trúc tài liệu Diátaxis:** `docs/` theo chuẩn quốc tế (Architecture, How-To, Reference, Operations).

### Changed
- 349 automated tests, 61 test suites, 100% pass.

---

## [0.8.0] - 2026-09-10

### Added
- **7 Vai trò chuẩn hóa (RBAC):** `superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester`, `driver`.
- **Immutable Identity:** Trigger `trg_profiles_prevent_identity_change` — khóa `full_name` + `username` vĩnh viễn sau khi tạo.
- **Hybrid Archive & Force Purge:** Hard Delete cho tài khoản trống, Archive (`is_active=false`) cho tài khoản có lịch sử, Force Purge (`admin_purge_user_data`) cho superuser.
- **Sub-zones 2 cấp:** Phân bổ chi phí chính xác đến từng dãy trại.
- **User email notifications (migration 0063):** Notify khi phiếu được duyệt/từ chối.
- **Performance indexes (migration 0064):** 38+ indexes tối ưu query.

---

## [0.7.0] - 2026-09-08

### Added
- **Trạm Bồn Xăng Dầu & Xe Cơ Giới (`/fuel`, `/fuel/scan`):** Quét QR 5 giây trên xe, nhập ODO/giờ máy, tự động tính L/100km hoặc L/h, cảnh báo tiêu hao bất thường.
- **Mượn-Trả Dụng Cụ Đồ Nghề (`/tools`):** Tủ đồ nghề dùng chung, theo dõi hạn trả, cảnh báo quá hạn mượn.
- **Báo cáo & Phân tích (`/reports`):** Thẻ kho (Stock Card), XNT, Zone Costing (chi phí từng dãy trại), xuất Excel kế toán.

---

## [0.6.0] - 2026-09-06

### Added
- **Đổi 1-1 Cấp Tốc (`/defects`):** Xuất hàng mới + nhận hàng hỏng vào kho trong 1 atomic transaction. Xử lý trong ≤30 giây cho trường hợp cháy motor quạt/máy bơm trại gà.
- **Sửa chữa (`/repairs`) & Thanh lý (`/liquidations`):** Gom thiết bị đi quấn lại/sửa bên ngoài, nghiệm thu đưa về kho hoặc thanh lý ve chai.
- **PDF Vector chuẩn nhận diện:** `@react-pdf/renderer` + font `Be Vietnam Pro` + logo trại + QR code tra cứu.

---

## [0.5.0] - 2026-09-05

### Added
- **Username Login:** Đăng nhập bằng tên đăng nhập (không cần email cá nhân).
- **Trả lại vật tư thừa (`requisition_returns`):** Trả linh kiện thừa sau sửa trại, tự động cộng lại tồn.
- **Tách môi trường Dev/Prod:** Dev port 3001 (`.next-dev`), Prod port 3000 (`.next`) qua systemd `mtp-web`.

---

## [0.1.0] - 2026-09-01

### Added
- Khởi tạo Next.js 15 App Router, TypeScript Strict, Tailwind CSS v4, Supabase PostgreSQL 17 + RLS.
- Danh mục sản phẩm + biến thể, đa vị trí kho (`stock_locations`), sổ cái biến động kho (`stock_movements`).
- Phiếu nhập kho NCC và phiếu xuất kho nội bộ cơ bản.
