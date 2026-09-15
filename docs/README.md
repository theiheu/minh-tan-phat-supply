# 🧭 BẢN ĐỒ ĐIỀU HƯỚNG TÀI LIỆU HỆ THỐNG — MINH TÂN PHÁT SUPPLY

> Hệ thống Quản trị & Vận hành Kho Trang trại Gia cầm Công nghiệp Minh Tân Phát.  
> Nền tảng: **Next.js 15 (App Router)**, **TypeScript Strict**, **Tailwind CSS v4**, **Supabase (PostgreSQL 17 + RLS + RPC)** và **PWA Offline-First**.

Hệ thống tài liệu được thiết kế và sắp xếp theo tiêu chuẩn quốc tế **[Diátaxis Framework](https://diataxis.fr/)**, chia thành 4 góc phần tư độc lập phục vụ 4 nhu cầu khác nhau của người đọc:

```
                   ┌─────────────────────────────┬─────────────────────────────┐
                   │   THỰC HÀNH (PRACTICAL)     │    LÝ THUYẾT (THEORETICAL)  │
  ┌────────────────┼─────────────────────────────┼─────────────────────────────┤
  │ HỌC TẬP        │   🎓 TUTORIALS              │   🏗️ ARCHITECTURE           │
  │ (LEARNING)     │   Khởi đầu & Nhập môn       │   Giải thích Kiến trúc      │
  ├────────────────┼─────────────────────────────┼─────────────────────────────┤
  │ THAO TÁC       │   📖 HOW-TO GUIDES          │   📚 REFERENCE              │
  │ (INFORMATION)  │   Sổ tay Nghiệp vụ 01-14    │   Tham chiếu Kỹ thuật       │
  └────────────────┴─────────────────────────────┴─────────────────────────────┘
```

---

## 1. 🎓 KHỞI ĐẦU & NHẬP MÔN (TUTORIALS & ONBOARDING)

Dành cho nhân sự mới, kỹ sư mới tiếp nhận dự án hoặc quản lý trang trại làm quen với hệ thống:

| Tài liệu | Đối tượng | Mục tiêu & Kết quả đạt được |
|---|---|---|
| [**Sổ Tay Vận Hành Trại Thực Chiến**](../SO_TAY_VAN_HANH_TRAI.md) | Nhân sự trại, Quản lý, Thợ | Hướng dẫn 10 tình huống thực tế thường nhật tại trại gà (cháy motor, xe đổ dầu, cấp bóng đèn, kiểm kê). |
| [**Tổng Quan Đăng Nhập & Phân Quyền**](./user-guide/01-tong-quan-dang-nhap.md) | Toàn bộ nhân viên | Làm quen với cách đăng nhập bằng username không cần email, đổi mật khẩu và xem quyền hạn. |
| [**Cẩm Nang Phát Triển (Build Guide)**](../BUILD_GUIDE.md) | Kỹ sư CNTT / AI Agent | Bản đặc tả kỹ thuật chi tiết từ A-Z để dựng và mở rộng hệ thống từ đầu. |

---

## 2. 📖 SỔ TAY HƯỚNG DẪN TÁC VỤ (HOW-TO GUIDES)

14 bài hướng dẫn chi tiết từng bước giải quyết các bài toán nghiệp vụ thực tế:

| STT | Tài liệu nghiệp vụ | Đối tượng chính | Tóm tắt quy trình thực hiện |
|:---:|---|---|---|
| **01** | [**Đăng nhập, Tài khoản & Phân quyền**](./user-guide/01-tong-quan-dang-nhap.md) | Tất cả nhân sự | Đăng nhập username, đổi mật khẩu, xem vai trò và khu vực. |
| **02** | [**Quản lý Danh mục Vật tư & Mã QR**](./user-guide/02-quan-ly-vat-tu-qr.md) | Quản kho, Kỹ thuật | Tra cứu danh mục, tồn kho an toàn, tạo vật tư và in mã QR kệ hàng. |
| **03** | [**Nhập kho từ Nhà Cung Cấp & Hóa Đơn**](./user-guide/03-nhap-kho-vat-tu.md) | Quản kho, Kế toán | Nhập kho NCC, upload hóa đơn VAT, tự động cấp phát phiếu đã duyệt. |
| **04** | [**Xuất kho Nội bộ & Bán hàng**](./user-guide/04-xuat-kho-cap-phat.md) | Quản kho, Kế toán | Lập phiếu xuất gắn theo Dãy chuồng (sub_zone), xuất bán thương mại. |
| **05** | [**Yêu cầu Vật tư Chuồng trại (Duyệt 2 cấp)**](./user-guide/05-yeu-cau-vat-tu.md) | Công nhân, Kỹ thuật, Quản kho | Giỏ hàng xin cấp vật tư, Kỹ thuật duyệt cấp 1, Kho xuất và trả hàng thừa. |
| **06** | [**Đổi 1-1 Cấp tốc & Báo hỏng Thiết bị**](./user-guide/06-doi-1-1-va-bao-hong.md) | Kỹ thuật, Quản kho | Đổi motor/bơm cháy lấy hàng mới trong 30 giây, gom đồ hỏng về kho. |
| **07** | [**Sửa chữa Cơ điện & Thanh lý Phế liệu**](./user-guide/07-sua-chua-thanh-ly.md) | Kỹ thuật, Quản kho, Chủ trại | Gửi xưởng sửa quấn motor, nghiệm thu tái sử dụng hoặc thanh lý ve chai. |
| **08** | [**Mượn - Trả Dụng cụ & Đồ nghề**](./user-guide/08-muon-tra-dung-cu.md) | Quản kho, Thợ kỹ thuật | Quản lý tủ đồ nghề (máy hàn, thang nhôm), theo dõi hạn trả, cảnh báo quá hạn. |
| **09** | [**Trạm Bồn Xăng Dầu & Xe cộ (Quét QR 5s)**](./user-guide/09-kho-xang-dau-xe.md) | Quản kho dầu, Tài xế | Quét QR dán trên xe, cấp phát dầu Diesel, tự động tính Lít/100km hoặc Lít/giờ. |
| **10** | [**Chuyển kho & Kiểm kê Cân bằng Tồn**](./user-guide/10-chuyen-kho-kiem-ke.md) | Quản kho, Kế toán, Chủ trại | Điều chuyển đa kho nội bộ, mở phiên kiểm kê thực tế bằng QR, cân bằng thừa/thiếu. |
| **11** | [**Báo cáo Tổng hợp, Tiêu hao & Xuất Excel**](./user-guide/11-bao-cao-phan-tich.md) | Chủ trại, Kế toán | Dashboard tài chính, Thẻ kho, XNT, Báo cáo chi phí chuồng, Xuất Excel/PDF. |
| **12** | [**In ấn Phiếu Chuẩn & Tem Nhãn QR**](./user-guide/12-in-an-va-tem-nhan.md) | Quản kho, Kế toán, Kỹ thuật | In phiếu nhập/xuất/yêu cầu khổ A4/A5, in tem nhãn QR dán kệ hàng, dán xe. |
| **13** | [**Quy đổi Đơn vị Tính & Đóng gói Đa cấp**](./user-guide/13-quy-doi-don-vi-dong-goi.md) | Quản trị, Quản kho, Kỹ thuật | Thiết lập quy đổi Thùng/Hộp/ml, xin cấp theo đơn vị linh hoạt, tự động trừ tồn kho. |
| **14** | [**Quản trị Người dùng & Cấu trúc Khu Chuồng**](./user-guide/14-quan-tri-nguoi-dung-va-khu-vuc.md) | Quản trị viên, Chủ trại, Kế toán | Quản lý 7 vai trò, khóa định danh bất biến, cơ chế Hybrid Archive, quản trị Zones/Sub-zones. |

---

## 3. 🏗️ KIẾN TRÚC & GIẢI THÍCH CƠ CHẾ (ARCHITECTURE & EXPLANATION)

Dành cho Kỹ sư Phần mềm, DevOps và AI Agent tìm hiểu sâu về kiến trúc hệ thống:

| Tài liệu kiến trúc | Nội dung trọng tâm |
|---|---|
| [**Kiến Trúc Tổng Quan Hệ Thống**](./architecture/system-overview.md) | Tech stack Next.js 15 + Supabase + Tailwind, Server Actions, Caching, PWA Offline Service Worker & PDF Printing. |
| [**Ma Trận Phân Quyền 7 Vai Trò (RBAC)**](./architecture/rbac-and-roles.md) | Chi tiết ma trận 7 vai trò (`superuser`, `owner`, `accountant`, `warehouse`, `technician`, `requester`, `driver`), Immutable Identity & Hybrid Archive. |
| [**Mô Hình Cơ Sở Dữ Liệu & ERD**](./architecture/database-schema.md) | Sơ đồ quan hệ thực thể cốt lõi, danh mục bảng, ràng buộc khóa ngoại, Triggers & PostgreSQL Security Definer RPCs. |
| [**Vòng Đời Chứng Từ & Máy Trạng Thái**](./architecture/state-machines.md) | Biểu đồ trạng thái & điều kiện chuyển đổi của Requisitions, Receipts, Issues, Defects, Repairs, Tools, Stocktake. |

---

## 4. 📚 THAM CHIẾU KỸ THUẬT (TECHNICAL REFERENCE)

Tài liệu tra cứu nhanh thông số kỹ thuật, cấu trúc trường dữ liệu, APIs và câu lệnh:

| Tài liệu tham chiếu | Phạm vi tra cứu |
|---|---|
| [**Từ Điển 39 Bảng Cơ Sở Dữ Liệu**](./reference/database-tables.md) | Chi tiết từng cột, kiểu dữ liệu, ràng buộc NULL, giá trị mặc định và ý nghĩa nghiệp vụ của 39 bảng và 2 views. |
| [**Danh Mục 73 RPCs, Triggers & Functions**](./reference/rpc-and-functions.md) | Danh sách đầy đủ 73 hàm PostgreSQL, tham số đầu vào, kiểu dữ liệu trả về và cơ chế giao dịch an toàn. |
| [**Bản Đồ Định Tuyến App Router & APIs**](./reference/app-routes-and-navigation.md) | Toàn bộ danh mục 30+ URLs trang, Route Groups `(app)` vs `(auth)`, API handlers và quyền hạn truy cập. |
| [**Danh Mục 25 CLI Scripts Vận Hành**](./reference/cli-scripts.md) | Hướng dẫn sử dụng các script trong `scripts/` (seed dữ liệu, deploy, benchmark, kiểm thử dòng nghiệp vụ). |

---

## 5. ⚙️ VẬN HÀNH, TRIỂN KHAI & BẢO TRÌ (OPERATIONS)

Quy trình triển khai thực tế trên máy chủ, xử lý sự cố khẩn cấp và bảo trì dữ liệu:

| Tài liệu vận hành | Nội dung chính |
|---|---|
| [**Hướng Dẫn Triển Khai Production (Runbook)**](./operations/deployment-runbook.md) | Cài đặt môi trường, Docker Compose, cấu hình Systemd, biến môi trường `.env.production` & Auto Deploy script. |
| [**Sổ Tay Xử Lý Sự Cố (Troubleshooting)**](./operations/troubleshooting.md) | Hướng dẫn khắc phục lỗi CSDL, mất kết nối mạng ngoại tuyến chuồng trại, quên mật khẩu admin, lỗi font in PDF. |
| [**Sao Lưu & Phục Hồi Dữ Liệu (Backup & Recovery)**](./operations/backup-and-recovery.md) | Quy trình sao lưu định kỳ PostgreSQL (`pg_dump`), sao lưu Supabase Storage, lập lịch Cronjob và phục hồi thảm họa. |
| [**Cấu Hình Tên Miền, SSL & SMTP Email**](./DOMAIN_AND_EMAIL_SETUP.md) | Thiết lập bản ghi DNS, reverse proxy Caddy tự động cấp SSL HTTPS miễn phí, cấu hình gửi email doanh nghiệp. |

---

## 📜 LỊCH SỬ THAY ĐỔI & BẢN QUYỀN

* [**CHANGELOG.md**](../CHANGELOG.md): Toàn bộ nhật ký các phiên bản phát hành từ ban đầu đến hiện tại.
* **Đơn vị vận hành thực tế:** Trang Trại Gà Đẻ Trứng Lê Văn Dương (Minh Tân, Dầu Tiếng, Bình Dương).
* **Phát triển & Bảo trì:** Antigravity Team.