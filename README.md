# 🐔 MTP Farm ERP — Hệ Thống Quản Trị Trại Gà Minh Tân Phát
### Đơn vị áp dụng: Trang Trại Gà Đẻ Trứng Lê Văn Dương (Dầu Tiếng, Bình Dương)

![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17-3ecf8e?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)
![Performance](https://img.shields.io/badge/Tốc_độ-~200ms-success?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-Offline_Ready-orange?style=flat-square)

Hệ thống phần mềm quản trị chuyên biệt dành cho **trang trại chăn nuôi gà đẻ trứng quy mô công nghiệp**, số hóa toàn diện từ quản lý kho bãi, vật tư cơ điện, cấp phát nhiên liệu xăng dầu cho xe cơ giới và máy phát điện, kiểm soát chi phí thực tế theo từng dãy chuồng trại.

---

## 📦 CÁC TÍNH NĂNG CHÍNH HIỆN TẠI

### 1. 🔍 Quản lý Danh mục Vật tư & Phụ tùng (`/products`)
* Tra cứu vật tư có hình ảnh thực tế, mã QR, thông số kỹ thuật và vị trí kệ hàng.
* Hỗ trợ vật tư đa biến thể (công suất, kích cỡ, điện áp) và vật tư theo bộ (Composite Kits).
* Cảnh báo tồn kho tối thiểu (Min/Max Stock) để chủ động đặt hàng dự phòng.

### 2. 📝 Phiếu Yêu cầu & Cấp phát Nội bộ (`/requisitions`, `/issues`)
* Tạo phiếu xin cấp vật tư dạng giỏ hàng tiện lợi trên điện thoại.
* Quy trình duyệt 4 bước: Tạo nháp ➜ Chờ duyệt ➜ Xuất kho ➜ Người nhận xác nhận.
* Bắn chuông thông báo (Notification) tức thì và yêu cầu người nhận bấm nút xác nhận khi nhận hàng.
* Xuất bán phân gà, vỉ trứng hoặc thiết bị cũ cho khách hàng/thương lái bên ngoài.

### 3. ⚡ Báo hỏng & Đổi mới 1-1 Cấp tốc (`/defects`)
* Chụp ảnh vật tư hư hỏng tại chuồng (motor quạt, máy bơm, núm uống...).
* Bấm 1 chạm **"Đổi 1-1"** trong dưới 30 giây: tự động trừ 1 hàng mới từ Kho Tổng đi lắp ngay và nạp 1 hàng hỏng vào Kho Hỏng.

### 4. 🔄 Chuỗi Vòng đời Thiết bị: Sửa chữa & Thanh lý (`/repairs`, `/liquidations`)
* **Gom sửa chữa (`/repairs`):** Gom thiết bị hỏng gửi thợ ngoài quấn motor/hàn xì; nghiệm thu đạt trả về Kho Tổng sẵn sàng dùng tiếp.
* **Thanh lý phế liệu (`/liquidations`):** Xuất bán ve chai, phế liệu sắt nhôm không thể sửa, ghi nhận doanh thu thanh lý về quỹ trại.

### 5. 🧰 Mượn - Trả Dụng cụ & Đồ nghề (`/tools`)
* Quản lý danh mục đồ nghề giá trị cao (máy hàn, máy mài, máy xịt rửa, kìm bấm cáp, thang nhôm).
* Theo dõi ai mượn, ngày mượn, mục đích sử dụng; cảnh báo quá hạn mượn (Overdue alerts).

### 6. ⛽ Quản lý Trạm Cấp Dầu & Xe Cơ Giới (`/fuel`, `/fuel/scan`)
* Quản lý dàn xe ben chở phân, xe xúc lật, xe bồn cám và máy phát điện dự phòng 250kVA.
* Nhập bồn dầu tổng (`/fuel/receipts`) từ xe bồn, quản lý đơn giá và đo hao hụt bồn chứa.
* **Quét mã QR 5 giây:** Quét tem QR dán trên xe ➜ Nhập số lít và Odo mới ➜ Tự động tính định mức tiêu hao ($L/100km$ hoặc $L/giờ$) và cảnh báo nếu tiêu hao bất thường.

### 7. 📥 Nhập kho Nhà Cung Cấp & Lưu trữ Hóa đơn (`/receipts`)
* Ghi nhận nhập hàng từ nhà cung cấp, cập nhật đơn giá vốn.
* Chụp ảnh hóa đơn đỏ / phiếu giao hàng đính kèm trực tiếp lên phiếu để đối soát chéo.

### 8. 📋 Kiểm kê Kho & Tự động Cân bằng (`/stocktake`)
* Khởi tạo phiên kiểm kê theo từng dãy kệ hoặc toàn bộ kho.
* Quét mã QR kiểm đếm số lượng thực tế, hiển thị trực quan thừa/thiếu, tự động tạo bút toán cân bằng kho sau khi duyệt.

### 9. 📊 Báo cáo, Phân tích Chi phí & In ấn Chuẩn hóa (`/reports`)
* Báo cáo Xuất - Nhập - Tồn (XNT) chi tiết theo khoảng ngày.
* Báo cáo phân bổ chi phí vật tư, điện, dầu theo từng Khu vực / Dãy chuồng (`Zone Costing`).
* Xuất dữ liệu ra file Excel và In PDF A4/A5 chuẩn nhận diện thương hiệu Trại Gà Lê Văn Dương.

### 10. 🌐 Trải nghiệm Thực địa & Công nghệ
* **Tốc độ siêu tốc (~200ms/trang):** Áp dụng Next.js 15 Server Components + 38 Database Indexes + RAM Cache Metadata.
* **Ngoại tuyến (Offline PWA):** Hoạt động bình thường cả khi mất sóng ở góc chuồng xa, tự đồng bộ khi có mạng lại.
* **Đăng nhập Username:** Không cần email, công nhân đăng nhập bằng tên tài khoản ngắn gọn.

---

## 🚀 ĐỊNH HƯỚNG MỞ RỘNG ERP TOÀN DIỆN (POULTRY ERP ROADMAP)

Hệ thống đã có sẵn bản Kế hoạch (Plan) và Thiết kế (Spec) để mở rộng tiếp 3 giai đoạn:

* **Giai đoạn 1 (Sản lượng & Đàn gà):** Quản lý lứa gà theo chuồng, theo dõi gà chết/loại thải hằng ngày, nhật ký thu nhặt trứng theo ca (sáng/chiều), phân loại trứng (loại 1, loại 2, dập...), tính tức thì tỷ lệ đẻ **% Laying Rate**, quản lý giá và xuất bán trứng cho thương lái.
* **Giai đoạn 2 (Thức ăn & Thú y):** Quản lý tiêu thụ Cám (g/con/ngày), tính chỉ số chuyển hóa **FCR** (kg cám/kg trứng), cảnh báo ăn giảm sớm (báo động ủ bệnh), lịch Vắc-xin tự động theo tuần tuổi, cảnh báo thời gian ngưng thuốc cách ly an toàn sinh học.
* **Giai đoạn 3 (Tài chính P&L):** Báo cáo **Giá thành sản xuất 1 quả trứng (Cost per Egg)** theo ngày, Báo cáo Lãi/Lỗ ròng (P&L) toàn trại, Chấm công ca nhặt trứng & Thưởng năng suất chuồng.

---

## 🛠️ HƯỚNG DẪN KHỞI CHẠY

```bash
# 1. Khởi động môi trường phát triển (Dev 3001):
bash scripts/dev-up.sh

# 2. Kiểm tra chất lượng mã nguồn & chạy 318 unit tests:
pnpm typecheck
pnpm test

# 3. Deploy Web Production (Cổng 3000):
bash scripts/deploy.sh
```

---

## 📞 THÔNG TIN LIÊN HỆ

* **Đơn vị phát triển:** Antigravity Team
* **Đơn vị áp dụng:** Trang Trại Gà Đẻ Trứng Lê Văn Dương
* **Địa chỉ:** Ấp Tân Tiến, Xã Minh Tân, Huyện Dầu Tiếng, Tỉnh Bình Dương
* **Hotline hỗ trợ:** 0988 365 238 – 0963 077 879
