# Hệ thống Quản lý Kho & Vật tư Trại Gà Minh Tân Phát
### (Trại Gà Đẻ Trứng Lê Văn Dương)

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-black?style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%2B_Auth-3ecf8e?style=flat-square)
![Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df?style=flat-square)

Hệ thống phần mềm quản trị chuyên biệt dành cho **trang trại chăn nuôi gia cầm / gà đẻ trứng quy mô công nghiệp**, giải quyết trọn vẹn bài toán quản lý kho vật tư, cơ điện chuồng trại, cấp phát nhiên liệu xăng dầu cho xe cơ giới và máy phát điện dự phòng, xử lý sự cố cấp tốc 1-1, kiểm soát chi phí thực tế theo từng khu chuồng.

---

## 📖 TÀI LIỆU DỰ ÁN
* 📘 **[SỔ TAY VẬN HÀNH & XỬ LÝ SỰ CỐ HÀNG NGÀY (`SO_TAY_VAN_HANH_TRAI.md`)](./SO_TAY_VAN_HANH_TRAI.md)** — Cẩm nang thực chiến chi tiết dành cho Chủ trại, Quản lý, Thủ kho, Trưởng khu chuồng và Tài xế.
* 🛠️ **[BUILD GUIDE V2 ĐẶC TẢ KỸ THUẬT TOÀN DIỆN (`BUILD_GUIDE.md`)](./BUILD_GUIDE.md)** — Đặc tả kỹ thuật duy nhất: Data Model SQL, State Machine, RPC Ledger, API, UI Specs.
* 🚀 **[HƯỚNG DẪN TRIỂN KHAI VẬN HÀNH (`DEPLOYMENT.md`)](./DEPLOYMENT.md)** — Cấu hình Systemd, Nginx, Sao lưu cơ sở dữ liệu.

---

## 🌾 NHỮNG BÀI TOÁN HỆ THỐNG GIẢI QUYẾT CHO TRẠI GÀ

| Vấn đề nhức nhối thực tế tại trại gà | Cách hệ thống giải quyết triệt để |
|---|---|
| **1. Sự cố thiết bị khẩn cấp (Cháy motor quạt, hỏng béc nước giữa trưa)**<br>Nếu bắt công nhân làm phiếu xin duyệt qua nhiều cấp thì gà bị ngợp nóng, nguy cơ chết hàng loạt. Còn nếu cho lấy tự do thì mất kiểm soát tồn kho. | **Cơ chế Đổi 1-1 Cấp Tốc trong 30 giây (`/defects`):**<br>Thủ kho thao tác 1 chạm trên điện thoại: Tự động trừ 1 hàng mới trong Kho Tổng giao đi lắp ngay, đồng thời cộng 1 đồ hỏng vào Kho Hỏng. Không nghẽn quy trình, cứu đàn gà kịp thời và số liệu vẫn chính xác 100%. |
| **2. Thất thoát & Khó kiểm soát Nhiên liệu (Dầu Diesel xe xúc, máy phát)**<br>Trại có dàn xe ben chở phân, xe cuốc, xe bồn cám và máy phát điện 250kVA. Ghi sổ tay dễ bị quên, gian lận hoặc rút trộm dầu. | **Quản lý Kho Dầu & Quét QR Phương tiện 5 giây (`/fuel`):**<br>Mỗi xe/máy có 1 tem mã QR chống nước. Quét mã tự động nhận diện xe, tài xế và Odo/giờ máy lần trước. Nhập số lít và Odo mới -> Tự động tính Lít/100km hoặc Lít/giờ, cảnh báo ngay khi tiêu hao bất thường. |
| **3. Không rõ chi phí thực tế của từng khu chuồng trại**<br>Cuối tháng không biết Chuồng Đẻ 1, Chuồng Đẻ 2, hay Nhà Ấp tốn bao nhiêu chi phí vật tư bóng đèn, thuốc men, tấm làm mát để tính giá thành trứng. | **Phân bổ Chi phí Tự động theo Khu vực (`Zone Cost`):**<br>Mọi phiếu xuất kho và phiếu cấp dầu đều gắn với một Khu vực (Zone). Báo cáo phân tích hiển thị chi tiết chi phí từng chuồng chỉ sau 1 cú click. |
| **4. Hàng hỏng gom đống không rõ còn sửa được hay bán ve chai**<br>Motor quạt cháy, bơm nước hỏng chất đống ở xưởng cơ điện, lâu ngày bị mục nát hoặc mất cắp linh kiện. | **Vòng đời Thiết bị Khép kín (Hỏng ➜ Sửa chữa ➜ Thanh lý):**<br>Ghi nhận từng đợt gửi thợ quấn lại motor (lưu chi phí sửa, nghiệm thu đạt trả về Kho Tổng; không đạt chuyển Thanh lý phế liệu/thu tiền ve chai). |
| **5. Công nhân chuồng & Thợ cơ điện ngại dùng phần mềm phức tạp**<br>Nhiều phần mềm yêu cầu email, mật khẩu dài dòng, giao diện kế toán rối mắt. | **Tối ưu Thực địa (Đăng nhập Username + Giao diện Giỏ hàng):**<br>Đăng nhập bằng Tên đăng nhập ngắn gọn (`thukho_dung`, `truongchuong_tuan`). Đặt vật tư dạng giỏ hàng như mua sắm online trên điện thoại. |
| **6. Sai lệch số liệu khi Kiểm kê kho định kỳ**<br>Kho bãi rộng, hàng nghìn linh kiện nhỏ (co nối ống nước, ốc vít, bóng đèn), kiểm kê thủ công mất nhiều ngày. | **Mô đun Kiểm kê & Cân bằng kho tự động (`/stocktake`):**<br>Hỗ trợ kiểm kê theo từng dãy kệ, lọc danh mục, hiển thị trực quan thừa/thiếu, tự động tạo bút toán cân bằng kho sau khi duyệt. |

---

## 🏗️ KIẾN TRÚC & CÔNG NGHỆ (TECH STACK)

- **Frontend & Backend Shell:** Next.js 15 (App Router, Server Components + Server Actions).
- **Ngôn ngữ:** TypeScript (Strict mode).
- **Cơ sở dữ liệu & Xác thực:** Supabase (PostgreSQL 15 + Row Level Security + Supabase Storage lưu ảnh hóa đơn/chứng từ).
- **Quản lý State & Data Fetching:** TanStack React Query v5, Zustand v5.
- **Form & Validation:** React Hook Form, Zod schema validation.
- **UI & Styling:** Tailwind CSS v4, shadcn/ui, Lucide Icons, Sonner toasts.
- **In ấn & Xuất dữ liệu:** React-PDF (`@react-pdf/renderer`), SheetJS (`xlsx`), HTML5 Canvas QR Generator.
- **Môi trường chạy & Build:** Bun runtime.

---

## 📦 CÁC PHÂN HỆ CHỨC NĂNG CHÍNH

1. **Danh mục Vật tư & Đa biến thể (`/products`):** Quản lý vật tư, hình ảnh thực tế, mã vạch / mã QR, phân loại nhóm hàng, cảnh báo tồn kho tối thiểu.
2. **Phiếu Yêu cầu Vật tư (`/requisitions`):** Trưởng khu chuồng tạo yêu cầu -> Quản lý duyệt -> Cấp phát xuất kho -> Người yêu cầu xác nhận nhận hàng.
3. **Nhập kho Vật tư (`/receipts`):** Nhập hàng từ Nhà cung cấp, lưu đơn giá, chụp ảnh hóa đơn/chứng từ đính kèm.
4. **Xuất kho (`/issues`):** Xuất cấp nội bộ cho các khu chuồng trại hoặc Xuất bán cho khách hàng/thương lái (phân gà, vỉ trứng, tài sản cũ).
5. **Báo hỏng & Đổi 1-1 Cấp tốc (`/defects`):** Ghi nhận vật tư hư hỏng tại chuồng, thực hiện đổi mới lấy cũ ngay lập tức.
6. **Sửa chữa Thiết bị (`/repairs`):** Gom hàng hỏng đi sửa (quấn motor, hàn vá), nghiệm thu nhập lại Kho Tổng.
7. **Thanh lý Phế liệu (`/liquidations`):** Thanh lý ve chai, ghi nhận doanh thu thanh lý và xuất khỏi kho hỏng.
8. **Kho Dầu & Phương tiện (`/fuel`, `/fuel/scan`):** Quét QR cấp dầu trong 5 giây cho xe ben, máy xúc, máy phát điện; tính định mức tiêu hao Odo/giờ máy.
9. **Kiểm kê Kho (`/stocktake`):** Kiểm đếm kho thực tế theo kệ, phát hiện chênh lệch và cân bằng kho tự động.
10. **Báo cáo & Phân tích (`/reports`):** Báo cáo Xuất-Nhập-Tồn, Báo cáo chi phí theo khu vực, Báo cáo tiêu hao dầu xe, xuất Excel & in PDF chuẩn.
11. **Quản trị Hệ thống (`/admin`):** Quản lý Danh mục, Khu vực (Zones), Vị trí kho (Locations), Nhà cung cấp, Khách hàng, Phương tiện, Người dùng.

---

## 🖨️ MẪU IN PHIẾU CHUẨN & THƯƠNG HIỆU

Mọi chứng từ in ấn trong hệ thống đều tự động áp dụng biểu mẫu chuẩn mang thương hiệu:
```
TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG
Địa chỉ: Ấp Tân Tiến, xã Minh Tân, huyện Dầu Tiếng, tỉnh Bình Dương
Hotline: 0988 365 238 - 0963 077 879
```
Bao gồm đầy đủ logo trang trại, mã phiếu, bảng chi tiết hàng hóa, chữ ký 4 bên (Người lập - Người nhận - Thủ kho - Quản lý) và mã QR tra cứu phiếu gốc.

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY

### 1. Yêu cầu môi trường
- [Bun](https://bun.sh) (v1.1+) hoặc Node.js 20+
- Supabase CLI (khi phát triển local) hoặc kết nối trực tiếp Supabase Cloud

### 2. Cài đặt thư viện & Cấu hình
```bash
# Cài đặt dependencies
bun install

# Cấu hình biến môi trường
cp .env.example .env.local
# Chỉnh sửa NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local
```

### 3. Khởi chạy môi trường phát triển (Dev)
```bash
bun run dev        # Ứng dụng chạy tại: http://localhost:3001
bun run lint       # Kiểm tra chất lượng mã nguồn
bun run build      # Build bản phát hành production
```

### 4. Tài khoản mặc định (Test / Local)
Chạy lệnh khởi tạo dữ liệu mẫu:
```bash
bun run scripts/bootstrap.ts
```
- **Tài khoản Quản lý (`manager`):** Tên đăng nhập: `manager` / Mật khẩu: `password123`
- **Tài khoản Nhân viên (`requester`):** Tên đăng nhập: `requester` / Mật khẩu: `password123`

---

## ⚙️ VẬN HÀNH PRODUCTION (Tách biệt Web Production & Môi trường Dev)

Hệ thống triển khai thực tế trên máy chủ/máy trạm của trang trại được cấu hình chạy ngầm qua `systemd` dịch vụ `mtp-web`:

| Thao tác | Câu lệnh | Ghi chú |
|---|---|---|
| **Web chính thức đang chạy** | `http://localhost:3000` | Dịch vụ systemd `mtp-web` tự khởi động cùng máy tính |
| **Cập nhật Web chính từ code mới** | `bash scripts/deploy.sh` | Tự động build và kiểm tra health-check an toàn |
| **Xem nhật ký log Web chính** | `journalctl -u mtp-web -f` | Giám sát lỗi và truy cập thời gian thực |
| **Khởi động / Dừng dịch vụ** | `sudo systemctl restart mtp-web` | Dừng: `sudo systemctl stop mtp-web` |
| **Khởi động lại DB sau khi bật máy** | `bash scripts/dev-up.sh` | Bật lại Docker/Supabase khi máy chủ khởi động lại |

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN

```
minh-tan-phat-supply/
├── public/                 # Logo trang trại, thương hiệu, favicon, PWA manifest
├── src/
│   ├── app/                # Next.js 15 App Router (auth, app pages, API PDF/Export/QR)
│   │   ├── (auth)/login/   # Màn hình đăng nhập bằng username
│   │   ├── (app)/          # Các phân hệ nghiệp vụ chính
│   │   │   ├── dashboard/  # Bảng điều khiển tổng quan
│   │   │   ├── products/   # Danh mục & Giỏ hàng vật tư
│   │   │   ├── requisitions/# Phiếu yêu cầu
│   │   │   ├── receipts/   # Phiếu nhập kho
│   │   │   ├── issues/     # Phiếu xuất kho
│   │   │   ├── defects/    # Báo hỏng & Đổi 1-1
│   │   │   ├── repairs/    # Sửa chữa thiết bị
│   │   │   ├── liquidations/# Thanh lý phế liệu
│   │   │   ├── fuel/       # Phân hệ Kho Dầu & Quét QR xe
│   │   │   ├── stocktake/  # Kiểm kê & Cân bằng kho
│   │   │   ├── reports/    # Báo cáo tổng hợp
│   │   │   └── admin/      # Quản trị danh mục, xe cộ, người dùng
│   │   └── api/            # Export Excel, Render PDF, QR API
│   ├── features/           # Feature-first modular code (actions, components, schema, types)
│   ├── components/         # UI components dùng chung (shadcn/ui)
│   ├── lib/                # Supabase clients, Env validator, Helper utils
│   ├── stores/             # Zustand state stores (cart, ui)
│   └── types/              # Database schema & TypeScript definitions
├── supabase/
│   ├── migrations/         # Toàn bộ SQL schema, Trigger, RLS Policies, RPC Ledger functions
│   └── seed.sql            # Dữ liệu mẫu khởi tạo ban đầu cho trại gà
├── scripts/                # Script triển khai, bootstrap, bảo trì hệ thống
├── BUILD_GUIDE.md          # Đặc tả kỹ thuật chi tiết
├── SO_TAY_VAN_HANH_TRAI.md # Sổ tay vận hành thực tế tại trại gà
└── DEPLOYMENT.md           # Hướng dẫn hạ tầng & triển khai
```

---
*Bản quyền phát triển thuộc về **Trang trại Gà đẻ trứng Lê Văn Dương – Minh Tân Phát Supply** (2026).*
