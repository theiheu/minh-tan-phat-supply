# Bản Đồ Tài Liệu — Minh Tân Phát Supply

> Hệ thống Quản lý Kho & Vận Hành Trại Gà Đẻ Trứng Lê Văn Dương (Minh Tân, Dầu Tiếng, Bình Dương).  
> Stack: **Next.js 15 App Router** · **TypeScript Strict** · **Tailwind CSS v4** · **Supabase (PostgreSQL 17 + RLS + 77+ RPCs)** · **PowerSync & Serwist Offline-First** · **626 Tests / 117 Suites**

Tài liệu được xây dựng theo tiêu chuẩn **[Diátaxis Framework](https://diataxis.fr/)** — phân định 4 góc nhìn độc lập: *Kiến trúc (Architecture)*, *Hướng dẫn sử dụng (How-to Guides)*, *Tra cứu kỹ thuật (Reference)*, và *Vận hành (Operations)*.

---

## 🏗️ 1. Kiến trúc & Thiết kế Hệ thống (Architecture)

Dành cho kỹ sư phần mềm, kiến trúc sư hệ thống và AI Agents tìm hiểu nguyên lý thiết kế:

| Tài liệu | Nội dung Chính |
|---|---|
| [**Kiến trúc Tổng quan**](./architecture/system-overview.md) | High-level topology, Server Actions, PowerSync & Serwist PWA, Vector PDF engine, Omniroute AI Copilot, Sổ cái Append-Only, Metabase BI connection. |
| [**Phân quyền 7 Vai trò (RBAC)**](./architecture/rbac-and-roles.md) | 7 chuẩn vai trò (`superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester`, `driver`), vai trò BI (`metabase_readonly`), Bất biến định danh (Immutable Identity), Quản trị chứng từ cấp cao. |
| [**Database Schema & Data Model**](./architecture/database-schema.md) | Sơ đồ quan hệ thực thể (ERD), cấu trúc bảng PostgreSQL 17 (101 migrations), Append-only Ledger, Lot balances, BOM Virtual Kit, Sub-zones, Metabase BI Views, AI Knowledge vectors. |
| [**Vòng đời Chứng từ & State Machines**](./architecture/state-machines.md) | Máy trạng thái chi tiết của Requisitions (5 cột mốc tiến trình), Receipts, Issues, Defects, Exchanges, Repairs, Tools, Stocktake, Auto-fulfill FIFO, Master Force Delete & Reversal. |
| [**Kiến trúc PowerSync Offline-First**](./powersync-architecture-and-deployment.md) | Đồng bộ 2 chiều Supabase PostgreSQL ➔ SQLite WASM trong trình duyệt, xử lý ngoại tuyến mượt mà. |

---

## 📖 2. Sổ tay Hướng dẫn Nghiệp vụ Thực tế (User Guides)

16 bài hướng dẫn giải quyết từng nghiệp vụ cụ thể hàng ngày tại trang trại:

| STT | Tài liệu Hướng Dẫn | Đối Tượng Sử Dụng | Tóm Tắt Nghiệp Vụ |
|:---:|---|---|---|
| 01 | [**Đăng nhập & Quản lý Tài khoản**](./user-guide/01-tong-quan-dang-nhap.md) | Mọi nhân viên | Đăng nhập Username/Mật khẩu (không email), đổi mật khẩu, xem phân quyền. |
| 02 | [**Danh mục Vật tư & Khai báo SKU**](./user-guide/02-quan-ly-vat-tu-qr.md) / [**Chi tiết Khai báo 5 Bước**](./user-guide/02-huong-dan-tao-vat-tu-chi-tiet.md) | Quản kho, Kỹ thuật | Khai báo 4 mô hình: Đơn quy cách, Quy đổi UOM, Biến thể 3 trục, BOM Bộ lắp ráp. |
| 03 | [**Nhập kho NCC & Hóa đơn VAT**](./user-guide/03-nhap-kho-vat-tu.md) | Quản kho, Kế toán | Nhập kho, upload ảnh hóa đơn VAT có lightbox phóng to, cập nhật giá vốn, auto-fulfill phiếu đã duyệt. |
| 04 | [**Xuất kho & Hạch toán Dãy trại**](./user-guide/04-xuat-kho-cap-phat.md) | Quản kho, Kế toán | Xuất cấp nội bộ gắn Sub-zone trại, xuất bán thương mại cho khách hàng. |
| 05 | [**Tiến trình Yêu cầu & Hóa đơn (5 Bước)**](./user-guide/05-yeu-cau-vat-tu.md) | Công nhân, Kỹ thuật, Kho | Theo dõi tiến trình 5 cột mốc: *Gửi ➔ Duyệt ➔ Đặt hàng ➔ Đã xuất ➔ Hoàn tất*, chụp ảnh hóa đơn mua gấp từ điện thoại và đồng bộ phiếu nhập. |
| 06 | [**Đổi 1-1 Cấp Tốc & Báo Hỏng**](./user-guide/06-doi-1-1-va-bao-hong.md) | Kỹ thuật, Quản kho | Đổi motor/bơm cháy trong 30 giây cứu trại, bắt buộc ảnh hiện trường. |
| 07 | [**Sửa chữa Cơ điện & Thanh lý**](./user-guide/07-sua-chua-thanh-ly.md) | Kỹ thuật, Quản kho, Chủ trại | Gửi xưởng quấn motor, nghiệm thu về Kho Tổng, thanh lý phế liệu ve chai. |
| 08 | [**Mượn - Trả Dụng cụ Đồ nghề**](./user-guide/08-muon-tra-dung-cu.md) | Quản kho, Thợ cơ điện | Tủ đồ nghề dùng chung (máy hàn, thang nhôm), cảnh báo quá hạn mượn qua email. |
| 09 | [**Trạm Bồn Dầu & Quét QR Xe**](./user-guide/09-kho-xang-dau-xe.md) | Quản kho dầu, Tài xế | Quét tem QR xe trong 5 giây, nhập ODO/giờ máy, cấp dầu phương tiện hoặc cấp toàn khu/dãy trại, quản lý giấy tờ đăng kiểm. |
| 10 | [**Điều chuyển Kho & Kiểm kê**](./user-guide/10-chuyen-kho-kiem-ke.md) | Quản kho, Kế toán | Chuyển kho nội bộ, kiểm kê quét QR thực tế, chụp ảnh đối soát, duyệt cân bằng tồn kho. |
| 11 | [**Trung Tâm Báo Cáo & Phân Tích BI**](./user-guide/11-bao-cao-phan-tich.md) | Chủ trại, Kế toán | Hub báo cáo: Tổng quan Ban giám đốc, Sổ cái XNT, Thẻ kho Stock Card, Chi phí Dãy trại, Hiệu suất Đội xe, Metabase BI Views, xuất Excel. |
| 12 | [**In ấn Chứng từ & Tem Decal QR**](./user-guide/12-in-an-va-tem-nhan.md) | Quản kho, Kế toán | In phiếu A4/A5 có mã QR tra cứu, in tem QR dán kệ hàng và cabin xe. |
| 13 | [**Đơn vị Tính Đa cấp & Đóng gói**](./user-guide/13-quy-doi-don-vi-dong-goi.md) | Quản trị, Quản kho | Quản lý Thùng/Hộp/ml, cho phép xin cấp linh hoạt, tự động quy đổi Base UOM. |
| 14 | [**Quản trị Người dùng & Phân cấp Khu**](./user-guide/14-quan-tri-nguoi-dung-va-khu-vuc.md) | Quản trị, Chủ trại | Quản lý 7 roles, khóa định danh, lưu trữ/kích hoạt lại nhân viên, cấu hình Zones & Sub-zones. |
| 15 | [**Trợ lý AI Copilot & Tra cứu Tri thức**](./user-guide/15-ai-copilot-tro-ly-thong-minh.md) | Mọi nhân viên | Trò chuyện với AI Copilot RAG, hỏi đáp quy trình vận hành trại, quản trị knowledge documents. |
| 16 | [**Giao diện Dashboard theo Vai trò**](./user-guide/16-dashboard-theo-vai-tro.md) | 7 vai trò | Tổng quan các chỉ số KPI, tác vụ nhanh và lịch sử chứng từ may đo riêng cho từng vai trò. |

---

## 📚 3. Tra cứu Kỹ thuật Nhanh (Technical Reference)

| Tài liệu | Phạm vi Tra cứu |
|---|---|
| [**Từ điển Database Tables & Views**](./reference/database-tables.md) | Danh mục toàn bộ bảng PostgreSQL 17 và Metabase BI Views: cột, kiểu dữ liệu, khóa ngoại, ý nghĩa nghiệp vụ. |
| [**Danh mục RPCs & Functions**](./reference/rpc-and-functions.md) | Toàn bộ 77+ Security Definer RPCs, Triggers, helper functions, tham số và kiểu trả về. |
| [**App Routes & Navigation**](./reference/app-routes-and-navigation.md) | 35+ URLs App Router, phân hệ báo cáo, nhóm trang phân quyền và API routes chuyên dụng. |
| [**Danh mục CLI Scripts**](./reference/cli-scripts.md) | 28+ tập lệnh CLI trong `scripts/`: deploy, dev-up, seed, benchmark, verify-fuel-flow. |

---

## ⚙️ 4. Vận hành & Bảo trì (Operations Runbooks)

Dành cho Quản trị viên DevOps triển khai và bảo trì hệ thống ổn định 24/7:

| Tài liệu | Hướng dẫn Cụ thể |
|---|---|
| [**Deployment Runbook**](./operations/deployment-runbook.md) | Mô hình 2 phiên bản độc lập (Dev port 3001, Prod port 3000), Systemd `mtp-web.service`, Zero-downtime deploy. |
| [**Email Scheduler & SMTP Setup**](./operations/email-notification-scheduler.md) | Cấu hình cronjob / worker gửi email thông báo định kỳ qua SMTP, phân phối thông báo theo vai trò. |
| [**PowerSync Architecture & Sync Rules**](./powersync-architecture-and-deployment.md) | Triển khai PowerSync Service, định nghĩa Sync Streams và tối ưu SQLite cache. |
| [**Troubleshooting & Sửa lỗi Thường gặp**](./operations/troubleshooting.md) | Chẩn đoán lỗi Node v22 path, xung đột cổng, lỗi quyền Supabase storage, phục hồi dev server. |
| [**Backup & Disaster Recovery**](./operations/backup-and-recovery.md) | Sao lưu định kỳ PostgreSQL, sao lưu Storage files, kịch bản phục hồi khi xảy ra thảm họa. |
| [**Domain, SSL & Email Setup**](./DOMAIN_AND_EMAIL_SETUP.md) | Hướng dẫn trỏ tên miền Cloudflare, cấu hình SSL HTTPS Caddy/Nginx và cài đặt máy chủ mail SMTP. |

---

## 🏭 5. Sổ tay Thực chiến & Kế hoạch Phát triển

| Tài liệu | Mô tả |
|---|---|
| [**Sổ Tay Vận Hành Trại**](../SO_TAY_VAN_HANH_TRAI.md) | 10 tình huống thực tế thường gặp tại trại gà (cháy motor nửa đêm, xe đổ dầu theo khu, kiểm kê đột xuất, cấp phát tức thì...). |
| [**Superpowers & Aegis Roadmaps**](./superpowers/README.md) | Lưu trữ các bản thiết kế kỹ thuật (Specs), kế hoạch (Plans) và bằng chứng kiểm thử (Evidence). |
