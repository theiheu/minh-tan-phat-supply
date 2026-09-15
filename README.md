# 🐔 MTP Farm ERP — Hệ Thống Quản Trị Toàn Diện Trại Gà Minh Tân Phát
### Đơn vị áp dụng thực tế: Trang Trại Gà Đẻ Trứng Lê Văn Dương (Minh Tân, Dầu Tiếng, Bình Dương)

![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x_(Strict)-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17_%2B_RLS-3ecf8e?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)
![Performance](https://img.shields.io/badge/Tốc_độ_tải_trang-~200ms-success?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-Offline_Ready-orange?style=flat-square)
![Tests](https://img.shields.io/badge/Automated_Tests-349_Passed-brightgreen?style=flat-square)

> 📚 **TRUNG TÂM TÀI LIỆU VẬN HÀNH & KIẾN TRÚC KỸ THUẬT:**  
> Toàn bộ tài liệu chuẩn theo khung [**Diátaxis Framework**](https://diataxis.fr/) (Hướng dẫn tác vụ, Tham chiếu kỹ thuật, Giải thích kiến trúc và Vận hành) được tổ chức tập trung tại thư mục [**`docs/`**](./docs/README.md).

---

## 💡 Khái Niệm & Bản Chất ERP Trong Quản Trị Trang Trại

**ERP** (**Enterprise Resource Planning** - Hoạch định Nguồn lực Doanh nghiệp) là hệ thống phần mềm tích hợp đa chức năng, giúp đồng bộ hóa toàn bộ chuỗi cung ứng, kho bãi, cơ điện, xe cơ giới và chi phí vận hành trang trại trên **một cơ sở dữ liệu duy nhất theo thời gian thực (Single Source of Truth)**.

Áp dụng vào thực tế trang trại chăn nuôi gia cầm công nghiệp Minh Tân Phát:
* **Không còn sổ sách rời rạc:** Toàn bộ lịch sử nhập vật tư, cấp phát chuồng trại, đổ dầu xe ben và sửa chữa cơ điện đều được ghi nhận tức thì vào sổ cái (`stock_movements`, `fuel_movements`).
* **Định danh bất biến & Chống thất thoát:** Họ tên và username nhân sự được khóa cố định bằng Database Trigger; phiếu xuất kho nội bộ gắn đích danh từng Dãy chuồng (`Sub-zone`).
* **Đổi 1-1 cấp tốc trong 30 giây:** Xử lý tình huống cháy motor quạt thông gió hoặc máy bơm khẩn cấp, xuất ngay thiết bị mới cứu đàn gà mà không làm đứt gãy quy trình kiểm soát kho.

---

## 🧭 Cấu Trúc Hệ Thống Tài Liệu (Diátaxis Framework)

```
docs/
├── README.md                          # Bản đồ điều hướng tài liệu trung tâm
├── DOMAIN_AND_EMAIL_SETUP.md          # Hướng dẫn cấu hình tên miền, SSL HTTPS & SMTP Email
│
├── architecture/                      # 🏗️ GIẢI THÍCH KIẾN TRÚC (Explanation)
│   ├── system-overview.md             # Tổng quan kiến trúc Next.js 15, Server Actions, PWA & Caching
│   ├── rbac-and-roles.md              # Ma trận phân quyền 7 vai trò, Immutable Identity & Hybrid Archive
│   ├── database-schema.md             # Sơ đồ quan hệ thực thể (ERD), lược đồ bảng & RPCs
│   └── state-machines.md              # Vòng đời & máy trạng thái của toàn bộ các loại chứng từ
│
├── reference/                         # 📚 THAM CHIẾU KỸ THUẬT (Reference)
│   ├── database-tables.md             # Từ điển chi tiết 39 bảng CSDL, khóa ngoại & chỉ mục
│   ├── rpc-and-functions.md           # Danh mục 73 RPCs, Triggers & PostgreSQL Security Functions
│   ├── app-routes-and-navigation.md   # Bản đồ định tuyến URL App Router & phân quyền trang
│   └── cli-scripts.md                 # Danh mục 25 CLI Scripts vận hành, seed dữ liệu & kiểm thử
│
├── user-guide/                        # 📖 HƯỚNG DẪN TÁC VỤ (How-To Guides / User Manuals)
│   ├── 01-tong-quan-dang-nhap.md      # Đăng nhập bằng Username, đổi mật khẩu & phân quyền
│   ├── 02-quan-ly-vat-tu-qr.md        # Danh mục hàng hóa, tồn kho an toàn & quét mã QR
│   ├── 03-nhap-kho-vat-tu.md          # Nhập kho NCC, hóa đơn VAT & tự động cấp phát phiếu đã duyệt
│   ├── 04-xuat-kho-cap-phat.md        # Xuất kho nội bộ theo dãy chuồng & xuất bán thương mại
│   ├── 05-yeu-cau-vat-tu.md           # Quy trình xin cấp vật tư duyệt 2 cấp (Kỹ thuật -> Quản kho)
│   ├── 06-doi-1-1-va-bao-hong.md      # Đổi 1-1 motor cháy cấp tốc & gom thiết bị hỏng
│   ├── 07-sua-chua-thanh-ly.md        # Gửi xưởng sửa chữa cơ điện, nghiệm thu & thanh lý phế liệu
│   ├── 08-muon-tra-dung-cu.md         # Quản lý tủ đồ nghề dùng chung, cảnh báo quá hạn mượn
│   ├── 09-kho-xang-dau-xe.md          # Trạm bồn dầu, quét QR đổ dầu xe & tính định mức L/100km
│   ├── 10-chuyen-kho-kiem-ke.md       # Điều chuyển đa kho & kiểm kê định kỳ cân bằng tồn
│   ├── 11-bao-cao-phan-tich.md        # Dashboard tài chính, Thẻ kho, XNT, Báo cáo chi phí chuồng
│   ├── 12-in-an-va-tem-nhan.md        # In phiếu A4/A5 chuẩn nhận diện & in tem QR nhiệt
│   ├── 13-quy-doi-don-vi-dong-goi.md  # Quy đổi đơn vị tính đa cấp (Thùng, Hộp, ml, Bao, Kg)
│   └── 14-quan-tri-nguoi-dung-va-khu-vuc.md # Quản trị 7 vai trò, tài khoản nhân sự & khu chuồng
│
└── operations/                        # ⚙️ VẬN HÀNH & BẢO TRÌ (Operational Runbooks)
    ├── deployment-runbook.md          # Triển khai Production bằng Docker / Systemd & Auto Deploy
    ├── troubleshooting.md             # Cẩm nang xử lý sự cố thường gặp (Database, Network, Auth)
    └── backup-and-recovery.md         # Quy trình sao lưu định kỳ & phục hồi thảm họa CSDL
```

Ngoài ra, tại thư mục gốc của repository:
* [**`SO_TAY_VAN_HANH_TRAI.md`**](./SO_TAY_VAN_HANH_TRAI.md): Sổ tay thực chiến xử lý 10 tình huống thường nhật tại trại gà.
* [**`BUILD_GUIDE.md`**](./BUILD_GUIDE.md): Bản đặc tả kỹ thuật chi tiết dành cho kỹ sư phát triển.
* [**`DEPLOYMENT.md`**](./DEPLOYMENT.md): Hướng dẫn thiết lập máy chủ và triển khai self-host.
* [**`CHANGELOG.md`**](./CHANGELOG.md): Nhật ký thay đổi và lịch sử các phiên bản phát hành.

---

## 👥 Hệ Thống 7 Vai Trò Chuẩn Hóa (RBAC)

1. 👑 **`superuser` (Quản trị hệ thống):** Toàn quyền kỹ thuật, phân quyền, cấu hình hệ thống, dọn dẹp lịch sử test (`admin_purge_user_data`).
2. 💼 **`owner` (Chủ trại):** Xem báo cáo tài chính/giá vốn, duyệt thanh lý lớn, duyệt cân bằng kho, quản lý tài khoản.
3. 📊 **`accountant` (Kế toán):** Quản lý giá mua/bán, hóa đơn VAT, công nợ NCC/khách hàng, duyệt sổ sách kế toán.
4. 📦 **`warehouse` (Quản kho):** Toàn quyền xuất - nhập - chuyển kho, đổi 1-1 cấp tốc, quản lý trạm bồn dầu, kiểm kê kho.
5. 🔧 **`technician` (Kỹ thuật):** Quản lý cơ sở/khu chuồng phụ trách, duyệt cấp 1 phiếu xin cấp vật tư, nghiệm thu thiết bị sửa chữa.
6. 📋 **`requester` (Người yêu cầu):** Công nhân chuồng, thợ cơ điện: Lập phiếu xin cấp vật tư, mượn dụng cụ, báo hỏng thiết bị, xác nhận nhận hàng.
7. 🚛 **`driver` (Tài xế):** Lái xe ben, xe xúc: Quét mã QR đổ dầu tại trạm bồn, cập nhật số ODO/giờ máy.

---

## 📦 Các Phân Hệ Chức Năng Cốt Lõi

| Phân hệ | Đường dẫn | Chức năng chính |
|---|---|---|
| **Vật tư & Quy cách** | `/products`, `/admin/products` | Danh mục đa biến thể, quy đổi đơn vị tính đa cấp (Thùng/Hộp/ml), cảnh báo tồn an toàn, tra cứu QR. |
| **Nhập kho & NCC** | `/receipts`, `/admin/suppliers` | Nhập kho NCC, đính kèm ảnh hóa đơn đỏ VAT, tự động cấp phát cho phiếu yêu cầu đã duyệt (FIFO). |
| **Yêu cầu & Cấp phát** | `/requisitions`, `/issues` | Giỏ hàng xin cấp vật tư, duyệt 2 cấp (Kỹ thuật -> Quản kho), xuất kho nội bộ theo dãy chuồng, xuất bán khách hàng. |
| **Đổi 1-1 & Báo hỏng** | `/defects` | Đổi motor/bơm cháy lấy hàng mới trong 30 giây, chụp ảnh hiện trường, tự động chuyển kho hỏng. |
| **Sửa chữa & Thanh lý** | `/repairs`, `/liquidations` | Gom thiết bị hỏng đi quấn lại motor, nghiệm thu tái sử dụng, thanh lý ve chai thu hồi vốn. |
| **Dụng cụ & Đồ nghề** | `/tools` | Quản lý tủ đồ nghề dùng chung (máy hàn, máy mài, thang nhôm), theo dõi hạn trả, cảnh báo quá hạn. |
| **Trạm Dầu & Xe cộ** | `/fuel`, `/fuel/scan`, `/admin/vehicles` | Nhập bồn dầu, quét QR đổ dầu 5 giây, tự động tính định mức L/100km hoặc L/h, cảnh báo hao hụt. |
| **Chuyển kho & Kiểm kê** | `/transfers`, `/stocktake` | Điều chuyển đa kho nội bộ, mở phiên kiểm đếm thực tế bằng QR, cân bằng chênh lệch thừa/thiếu. |
| **Báo cáo & Phân tích** | `/reports` | Dashboard tài chính, Thẻ kho (Stock Card), Báo cáo XNT, Phân bổ chi phí theo dãy chuồng, Xuất Excel/PDF. |
| **Quản trị Người dùng** | `/admin/users`, `/admin/zones` | Quản trị tài khoản, khóa định danh bất biến (Trigger), cơ chế Hybrid Archive & Force Purge, quản trị khu chuồng. |

---

## 🚀 Định Hướng Mở Rộng (Poultry ERP Roadmap)

Hệ thống đã có sẵn bản Kế hoạch (Plan) và Thiết kế (Spec) trong thư mục `docs/superpowers/` để sẵn sàng mở rộng tiếp 3 giai đoạn:
* **Giai đoạn 1 (Sản lượng & Đàn gà):** Quản lý lứa gà theo dãy chuồng, theo dõi tỷ lệ đẻ **% Laying Rate**, phân loại trứng, xuất bán trứng thương phẩm.
* **Giai đoạn 2 (Thức ăn & Thú y):** Định mức cám (g/con/ngày), hệ số chuyển hóa **FCR**, cảnh báo ăn giảm sớm, lịch vắc-xin tự động và thời gian cách ly ngưng thuốc an toàn sinh học.
* **Giai đoạn 3 (Tài chính Nông trại):** Báo cáo **Giá thành sản xuất 1 quả trứng (Cost per Egg)** theo ngày, Báo cáo Lãi/Lỗ ròng (P&L) toàn trại, Chấm công ca nhặt trứng.

---

## 🛠️ Hướng Dẫn Khởi Chạy & Kiểm Thử

### 1. Cài đặt & Khởi chạy Môi trường Phát triển (Dev Port 3001)
```bash
# Cài đặt dependencies
pnpm install

# Khởi chạy môi trường dev (Next.js 15 Turbopack trên cổng 3001)
pnpm dev
# Hoặc dùng script điều khiển:
bash scripts/dev-up.sh
```

### 2. Kiểm tra Chất lượng Mã Nguồn & Chạy Test Suite
```bash
# Kiểm tra TypeScript nghiêm ngặt (0 lỗi)
pnpm typecheck

# Chạy toàn bộ 349 bài test tự động (61 test files)
pnpm test

# Chạy linter
pnpm lint
```

### 3. Triển khai Web Production (Port 3000)
```bash
# Tự động pull code, build an toàn ra .next-new, swap và restart service
pnpm deploy:prod
# Hoặc:
bash scripts/deploy.sh
```

---

## 📞 Thông Tin Liên Hệ & Đơn Vị Vận Hành

* **Đơn vị phát triển:** Antigravity Team
* **Đơn vị áp dụng:** Trang Trại Gà Đẻ Trứng Lê Văn Dương
* **Địa chỉ:** Ấp Tân Tiến, Xã Minh Tân, Huyện Dầu Tiếng, Tỉnh Bình Dương
* **Hotline hỗ trợ kỹ thuật:** 0988 365 238 – 0963 077 879