# Changelog

Ghi nhận các thay đổi quan trọng của dự án **Minh Tân Phát Supply**.  
Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/) + [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.12.0] - 2026-09-20

### Added
- **Tái thiết Trung tâm Báo cáo & Phân tích BI (`/reports`):**
  - Tab 1: Tổng quan Ban giám đốc (Executive KPI summary, biểu đồ xu hướng xuất kho theo tháng, top vật tư tiêu hao, cơ cấu danh mục).
  - Tab 2: Sổ cái & Vận hành (Sổ cái XNT xuất nhập tồn, Thẻ kho chi tiết Stock Card, Định giá tồn kho tức thời).
  - Tab 3: Phân tích Chi phí Dãy trại (Sub-zone Cost Drilldown) & Đội xe cơ giới (Fleet Fuel Efficiency & ODO).
  - Tab 4: Tích hợp Metabase / PowerBI trực tiếp và xuất dữ liệu Excel/CSV chuẩn kế toán.
- **Views Phân tích Metabase BI (Migration 0100):** Cung cấp các view phân tích tối ưu `v_bi_subzone_cost_breakdown`, `v_bi_inventory_xnt_summary`, `v_bi_fleet_fuel_efficiency` và role phân quyền đọc an toàn `metabase_readonly`.
- **Cấp Dầu Cho Toàn Khu & Phương tiện (Migration 0101):** Hỗ trợ 2 chế độ cấp phát nhiên liệu: Theo phương tiện (`vehicle`) hoặc Cấp cho toàn khu / nhiều dãy trại (`zone` / `sub_zone`). Làm giàu thông tin QR xe với chi tiết lần đổ gần nhất.
- **Tiến trình Yêu cầu 5 Cột mốc & Upload Hóa đơn (Migration 0097, 0098):**
  - Cột mốc tiến trình rõ ràng: *Gửi yêu cầu ➔ Kỹ thuật duyệt ➔ Đang đặt hàng NCC ➔ Kho xuất cấp ➔ Hoàn tất*.
  - Upload hóa đơn/chứng từ trực tiếp từ điện thoại với lightbox phóng to.
  - Tự động đồng bộ ảnh hóa đơn giữa Phiếu yêu cầu và Phiếu nhập kho (Receipts).
- **Hồ sơ Giấy tờ Xe Cơ Giới (Migration 0098):** Bổ sung quản lý ảnh đăng kiểm, bảo hiểm, cà vẹt (`document_images`) và cảnh báo hạn đăng kiểm trên giao diện quản trị xe.
- **Quản trị Chứng từ Cấp cao (Migration 0099):**
  - RPC `admin_inspect_document_dependencies` kiểm tra toàn diện cây quan hệ phụ thuộc trước khi xóa chứng từ.
  - RPC `admin_force_delete_document` cho phép Superuser và Chủ trại xóa cứng hoặc đảo kho an toàn đối với các chứng từ rác hoặc sai sót nghiệp vụ.
- **Động cơ PowerSync Offline-First:** Tích hợp đồng bộ dữ liệu 2 chiều với SQLite WebAssembly trong trình duyệt, phục vụ vận hành thông suốt khi mất kết nối mạng.
- **Bộ Kiểm thử Hoàn thiện:** Nâng tổng số bài kiểm tra tự động lên **626 tests / 117 test suites (100% passed)**.

---

## [0.11.0] - 2026-09-19

### Added
- **Chuyển giao Toàn diện Catalog SKU Baseline (Migrations 0088 - 0095):**
  - Chuẩn hóa hạt nhân ghi sổ cái kho Append-Only (`0088_enforce_append_only_ledger`).
  - Khắc phục tính toán số lượng đơn vị cơ sở theo lô (`0089_fix_receipt_lot_base_quantity`).
  - Đảm bảo tính lũy đẳng khi hoàn trả vật tư thừa (`0090_return_idempotency`).
  - Kiểm tra khả dụng tồn kho linh kiện cho Bộ ảo (`0091_virtual_kit_availability`).
  - Lưu vết kết quả tự động cấp phát bền vững (`0092_auto_fulfill_outcome`).
  - Chuẩn hóa danh mục Đơn vị tính cơ sở (`0094_seed_canonical_units`) và sửa lỗi tạo phiên kiểm kê (`0095_fix_stocktake_creation`).
- **Hệ thống Thông báo Email Đa vai trò (Migration 0096):** Quản lý cấu hình thông báo `notification_preferences`, xử lý batch digest định kỳ qua cron endpoint `/api/cron/notifications`.
- **Tái cấu trúc UI God Components:** Phân tách `ProductDetailDialog`, modularize hooks và components con nhằm tăng khả năng bảo trì.
- **Proxy An toàn cho Supabase Client:** Khắc phục triệt để vấn đề phân giải cổng kết nối trên trình duyệt.

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
