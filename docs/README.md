# Bản Đồ Tài Liệu — Minh Tân Phát Supply

> Hệ thống Quản lý Kho & Vật tư Trại Gà Đẻ Trứng Lê Văn Dương (Minh Tân, Dầu Tiếng, Bình Dương).  
> Stack: **Next.js 15 App Router** · **TypeScript Strict** · **Tailwind CSS v4** · **Supabase (PostgreSQL 17 + RLS + RPC)** · **PWA Offline-First**

Tài liệu theo tiêu chuẩn **[Diátaxis Framework](https://diataxis.fr/)** — 4 phần tư độc lập:

---

## 🏗️ Kiến trúc & Giải thích

Dành cho developer, DevOps, AI Agent hiểu sâu về hệ thống:

| Tài liệu | Nội dung |
|---|---|
| [**Kiến trúc Tổng quan**](./architecture/system-overview.md) | Tech stack, Server Actions, Caching, PWA, PDF, luồng dữ liệu |
| [**Phân quyền 7 Vai trò (RBAC)**](./architecture/rbac-and-roles.md) | 7 roles, Immutable Identity, Hybrid Archive, RLS policies |
| [**Database Schema & ERD**](./architecture/database-schema.md) | Sơ đồ quan hệ thực thể, bảng chính, triggers, indexes |
| [**Vòng đời Chứng từ & State Machines**](./architecture/state-machines.md) | State machine của Requisitions, Receipts, Issues, Defects, Repairs, Tools, Stocktake |

---

## 📖 Sổ tay Hướng dẫn Nghiệp vụ

14 bài hướng dẫn chi tiết từng bước giải quyết bài toán thực tế tại trại:

| STT | Tài liệu | Đối tượng | Tóm tắt |
|:---:|---|---|---|
| 01 | [**Đăng nhập & Phân quyền**](./user-guide/01-tong-quan-dang-nhap.md) | Mọi nhân viên | Đăng nhập username, đổi mật khẩu, xem vai trò |
| 02 | [**Danh mục Vật tư & QR**](./user-guide/02-quan-ly-vat-tu-qr.md) / [**Tạo Vật tư Chi tiết**](./user-guide/02-huong-dan-tao-vat-tu-chi-tiet.md) | Quản kho, Kỹ thuật | Khai báo 5 bước, Multi-SKU 3 trục, BOM, Quy đổi, in QR |
| 03 | [**Nhập kho từ NCC & Hóa đơn**](./user-guide/03-nhap-kho-vat-tu.md) | Quản kho, Kế toán | Nhập kho, upload VAT, auto-fulfill phiếu duyệt |
| 04 | [**Xuất kho & Cấp phát**](./user-guide/04-xuat-kho-cap-phat.md) | Quản kho, Kế toán | Xuất gắn Sub-zone chuồng, xuất bán thương mại |
| 05 | [**Yêu cầu Vật tư (Duyệt 2 cấp)**](./user-guide/05-yeu-cau-vat-tu.md) | Công nhân, Kỹ thuật, Kho | Giỏ hàng, Kỹ thuật duyệt cấp 1, Kho xuất, trả thừa |
| 06 | [**Đổi 1-1 & Báo hỏng**](./user-guide/06-doi-1-1-va-bao-hong.md) | Kỹ thuật, Quản kho | Đổi motor/bơm trong 30 giây, gom đồ hỏng |
| 07 | [**Sửa chữa & Thanh lý**](./user-guide/07-sua-chua-thanh-ly.md) | Kỹ thuật, Quản kho, Chủ trại | Gửi xưởng sửa, nghiệm thu, thanh lý ve chai |
| 08 | [**Mượn-Trả Dụng cụ**](./user-guide/08-muon-tra-dung-cu.md) | Quản kho, Thợ | Tủ đồ nghề dùng chung, cảnh báo quá hạn |
| 09 | [**Trạm Bồn Dầu & Xe cộ**](./user-guide/09-kho-xang-dau-xe.md) | Quản kho dầu, Tài xế | QR xe, cấp phát dầu, L/100km hoặc L/h |
| 10 | [**Chuyển kho & Kiểm kê**](./user-guide/10-chuyen-kho-kiem-ke.md) | Quản kho, Kế toán | Điều chuyển đa kho, kiểm kê QR, cân bằng thừa/thiếu |
| 11 | [**Báo cáo & Xuất Excel**](./user-guide/11-bao-cao-phan-tich.md) | Chủ trại, Kế toán | Dashboard, Thẻ kho, XNT, Zone Costing, Excel |
| 12 | [**In ấn & Tem QR**](./user-guide/12-in-an-va-tem-nhan.md) | Quản kho, Kế toán | In phiếu A4/A5, tem QR dán kệ hàng và xe |
| 13 | [**Đơn vị Tính Đa cấp**](./user-guide/13-quy-doi-don-vi-dong-goi.md) | Quản trị, Quản kho | Thùng/Hộp/ml, xin cấp linh hoạt, tự quy đổi tồn |
| 14 | [**Quản trị Người dùng & Zones**](./user-guide/14-quan-tri-nguoi-dung-va-khu-vuc.md) | Quản trị, Chủ trại | 7 roles, Immutable Identity, Hybrid Archive, Zones |

---

## ⚙️ Vận hành

Dành cho DevOps / Quản trị viên triển khai và duy trì hệ thống:

| Tài liệu | Nội dung |
|---|---|
| [**Deployment Runbook**](./operations/deployment-runbook.md) | Cài đặt, cấu hình, Systemd, Caddy/Nginx, zero-downtime deploy |
| [**Backup & Recovery**](./operations/backup-and-recovery.md) | Backup PostgreSQL, restore, disaster recovery |
| [**Troubleshooting**](./operations/troubleshooting.md) | Xử lý sự cố thường gặp |
| [**Domain & Email Setup**](./DOMAIN_AND_EMAIL_SETUP.md) | Cấu hình tên miền, SSL HTTPS, SMTP |

---

## 📚 Tham chiếu Kỹ thuật

Tra cứu nhanh thông số kỹ thuật:

| Tài liệu | Phạm vi |
|---|---|
| [**Từ điển Database Tables**](./reference/database-tables.md) | 39+ bảng: cột, kiểu, ràng buộc, ý nghĩa nghiệp vụ |
| [**Danh mục RPCs & Functions**](./reference/rpc-and-functions.md) | 73+ hàm PostgreSQL, tham số, kiểu trả về |
| [**App Routes & Navigation**](./reference/app-routes-and-navigation.md) | 30+ URLs, Route Groups, quyền hạn truy cập |
| [**CLI Scripts**](./reference/cli-scripts.md) | Scripts trong `scripts/`: seed, deploy, benchmark, verify |

---

## 🏭 Sổ tay Thực chiến Trại

| Tài liệu | Mô tả |
|---|---|
| [**Sổ Tay Vận Hành Trại**](../SO_TAY_VAN_HANH_TRAI.md) | 10 tình huống thực tế hàng ngày tại trại gà (cháy motor, xe đổ dầu, kiểm kê…) |

---

## 🔬 Superpowers (Kế hoạch kỹ thuật chuyên sâu)

| Tài liệu | Trạng thái |
|---|---|
| [**Thiết kế SKU Catalog Replacement**](./superpowers/specs/2026-09-16-unified-product-variant-workflow-design.md) | ✅ Approved — đang implement |
| [**Plan: Full Material Catalog Replacement**](./superpowers/plans/2026-09-16-full-material-catalog-replacement.md) | 🔄 In progress |