# MTP Farm ERP — Hệ Thống Quản Trị Toàn Diện Trại Gà Minh Tân Phát
### (Đơn vị áp dụng: Trại Gà Đẻ Trứng Lê Văn Dương — Dầu Tiếng, Bình Dương)

![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%2B_Auth-3ecf8e?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)
![Performance](https://img.shields.io/badge/Page_Load-~200ms-success?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-Offline_Ready-orange?style=flat-square)

---

## 📌 GIỚI THIỆU DỰ ÁN

**MTP Farm ERP** là hệ thống phần mềm quản trị số hóa chuyên biệt, được thiết kế "đo ni đóng giày" cho **Trang trại chăn nuôi gà đẻ trứng quy mô công nghiệp** (Trại gà Lê Văn Dương tại Ấp Tân Tiến, Xã Minh Tân, Huyện Dầu Tiếng, Bình Dương).

Hệ thống giải quyết triệt để các bài toán thực tế khắt khe của nông nghiệp công nghệ cao:
* **Hậu cần & Vật tư cơ điện chuồng trại:** Cứu sự cố quạt hút/điện lạnh trong 30 giây, không để ngạt gà.
* **Kiểm soát nhiên liệu xăng dầu:** Quét mã QR chống gian lận, đo định mức tiêu hao Odo/giờ máy.
* **Minh bạch tài chính & Vòng đời thiết bị:** Phân bổ chi phí đến từng dãy chuồng, quản lý quy trình gom sửa chữa và thanh lý phế liệu.
* **Sẵn sàng mở rộng thành ERP Trại gà Toàn diện:** Quản lý sản lượng trứng, tỷ lệ đẻ (% Laying Rate), thức ăn & chỉ số FCR, lịch vắc-xin thú y và giá thành sản xuất 1 quả trứng.

---

## 📖 DANH MỤC TÀI LIỆU DỰ ÁN

* 📘 **[Sổ Tay Vận Hành & Xử Lý Sự Cố Thực Chiến (`SO_TAY_VAN_HANH_TRAI.md`)](./SO_TAY_VAN_HANH_TRAI.md)** — Cẩm nang 10 tình huống thực tế cho Chủ trại, Quản lý, Thủ kho, Trưởng khu chuồng và Tài xế.
* 📋 **[Kế Hoạch Lộ Trình Mở Rộng ERP (`2026-09-12-chicken-farm-full-scale-roadmap.md`)](./docs/superpowers/plans/2026-09-12-chicken-farm-full-scale-roadmap.md)** — Bản kế hoạch chi tiết các giai đoạn mở rộng tính năng nông nghiệp.
* 📐 **[Đặc Tả Kỹ Thuật Mở Rộng (`2026-09-12-chicken-farm-full-scale-spec.md`)](./docs/superpowers/specs/2026-09-12-chicken-farm-full-scale-spec.md)** — Thiết kế Data Schema SQL, logic tính toán % Đẻ, FCR và P&L giá thành trứng.
* 🛠️ **[Build Guide Toàn Diện (`BUILD_GUIDE.md`)](./BUILD_GUIDE.md)** — Đặc tả kỹ thuật State Machine, RPC Ledger, API và UI Specs.
* 🚀 **[Hướng Dẫn Triển Khai & Vận Hành (`DEPLOYMENT.md`)](./DEPLOYMENT.md)** — Cấu hình Systemd, Nginx, Sao lưu cơ sở dữ liệu.

---

## 🌾 PHẦN I: NHỮNG BÀI TOÁN THỰC TẾ & CÁCH HỆ THỐNG GIẢI QUYẾT

Dưới đây là 7 bài toán nhức nhối nhất tại trại gà công nghiệp và cách hệ thống xử lý triệt để:

| STT | Vấn đề thực tế tại Trại Gà | Rủi ro nếu không có phần mềm | Hướng giải quyết của Hệ thống |
|:---:|---|---|---|
| **1** | **Sự cố quạt thông gió / điện lạnh giữa trưa** | Mất điện/cháy motor quạt quá 15 phút, nhiệt độ chuồng tăng vọt làm **gà ngạt chết hàng loạt**, sụt giảm sản lượng trứng cả tháng. | **Cơ chế Đổi 1-1 Cấp Tốc trong 30 giây (`/defects`):** Thủ kho chỉ cần 1 thao tác trên điện thoại: xuất ngay motor mới đi cứu chuồng, tự động ghi nhận đồ hỏng vào Kho Hỏng. Không chờ duyệt rườm rà. |
| **2** | **Thất thoát & khó kiểm soát Dầu Diesel** | Trại có dàn xe ben chở phân, xe xúc, xe bồn cám và máy phát điện dự phòng 250kVA. Ghi sổ tay dễ thất lạc, gian lận hoặc rút trộm dầu. | **Quét mã QR Xe Cơ Giới & Đo Định Mức (`/fuel`):** Mỗi xe/máy phát dán 1 tem QR chống nước. Quét mã 5 giây nhận diện xe, tự động tính Lít/100km hoặc Lít/giờ máy, cảnh báo ngay khi tiêu hao bất thường. |
| **3** | **Không rõ chi phí từng dãy chuồng trại** | Cuối tháng không biết Chuồng 1, Chuồng 2 hay Nhà Ấp tốn bao nhiêu tiền bóng đèn, thuốc sát trùng, tấm làm mát để tính giá thành nuôi. | **Phân bổ Chi phí Tự động theo Khu Vực (`Zone Costing`):** Mọi phiếu xuất kho và cấp dầu đều gắn với một Khu vực (Zone). Báo cáo phân tích hiển thị chi tiết chi phí từng chuồng sau 1 cú click. |
| **4** | **Vật tư hỏng chất đống, thất thoát linh kiện** | Motor quạt cháy, máy bơm hỏng chất đống ở góc xưởng, lâu ngày rỉ sét, mất phụ tùng hoặc bị bán ve chai giá rẻ mạt. | **Vòng đời Thiết bị Khép kín (Hỏng ➜ Gom Sửa ➜ Thanh lý):** Theo dõi chi phí gửi thợ quấn motor; nghiệm thu đạt trả về Kho Tổng; không sửa được thì thanh lý phế liệu có lưu giá thu tiền. |
| **5** | **Công nhân chuồng & Tài xế ngại dùng app** | Công nhân bận tay chân, không thạo máy tính; nhiều phần mềm bắt nhập email, mật khẩu phức tạp gây cản trở áp dụng. | **Giao diện Giỏ Hàng + Đăng nhập Username:** Đăng nhập bằng tên tài khoản ngắn gọn (`thukho_dung`, `truongchuong_tuan`). Đặt vật tư dạng giỏ hàng như mua sắm online trên điện thoại. |
| **6** | **Chênh lệch số liệu kiểm kê kho** | Kho bãi rộng, hàng nghìn linh kiện nhỏ (co nối ống nước, ốc vít, bóng đèn), kiểm kê giấy tờ mất nhiều ngày và hay sai lệch. | **Kiểm kê theo Kệ & Cân bằng kho tự động (`/stocktake`):** Phân chia kiểm kê theo dãy kệ, hiển thị trực quan thừa/thiếu, tự động tạo bút toán cân bằng tồn kho khi Quản lý duyệt. |
| **7** | **Mất mạng internet tại các góc chuồng xa** | Trại gà diện tích nhiều hecta, nhiều góc chuồng sóng 4G/Wifi yếu, không thể load trang để tạo phiếu yêu cầu. | **Công nghệ PWA Offline First:** Cho phép tạo phiếu ngoại tuyến khi không có mạng; dữ liệu tự động đồng bộ lên server ngay khi bắt lại được sóng. |

---

## 📦 PHẦN II: CÁC PHÂN HỆ CHỨC NĂNG & CÁCH VẬN HÀNH

### 1. Phân hệ Báo hỏng & Đổi mới 1-1 Cấp tốc (`/defects`)
* **Mục đích:** Xử lý sự cố vật tư khẩn cấp (motor quạt, máy bơm, núm uống...) mà không làm đứt gãy quy trình kiểm soát kho.
* **Cách vận hành:**
  1. Trưởng chuồng/Thợ điện phát hiện motor cháy -> Mở điện thoại chụp ảnh hiện trạng hỏng hóc, chọn mức độ hư hỏng.
  2. Thủ kho kiểm tra nhanh -> Bấm nút **"Đổi 1-1"**.
  3. Hệ thống tự động:
     - Trừ 1 motor mới từ **Kho Tổng** để đem đi lắp ngay cho chuồng gà.
     - Cộng 1 motor hỏng vào **Kho Hỏng (Defect Location)** để quản lý.
     - Toàn bộ thời gian xử lý chỉ mất **dưới 30 giây**.

### 2. Phân hệ Kho Dầu & Cấp phát Nhiên liệu Xe Cơ Giới (`/fuel`)
* **Mục đích:** Quản lý trạm cấp dầu Diesel nội bộ, kiểm soát dàn xe ben chở phân, xe cuốc, xe bồn cám và máy phát điện 250kVA.
* **Cách vận hành:**
  1. Xe đến vòi bơm dầu -> Nhân viên mở camera điện thoại quét **Tem QR** dán trên xe.
  2. Màn hình tự động hiển thị: Biển số xe, tên tài xế, số Odo/giờ máy của lần đổ trước.
  3. Nhập số lít dầu thực bơm và số Odo mới -> Hệ thống tự động tính:
     - Mức tiêu hao: Lít / 100km (xe tải) hoặc Lít / Giờ (xe cuốc, máy phát).
     - Đổi màu cảnh báo đỏ nếu phát hiện xe tiêu hao dầu vượt định mức quy định.
     - Tự động trừ tồn kho bồn dầu chính.

### 3. Phân hệ Gom Sửa Chữa & Nghiệm Thu Thiết Bị (`/repairs`)
* **Mục đích:** Quản lý việc gửi đồ hỏng đi quấn motor, gia công cơ khí bên ngoài, tối ưu chi phí tái sử dụng.
* **Cách vận hành:**
  1. Gom các thiết bị từ Kho Hỏng vào một **Phiếu sửa chữa** gửi đi đơn vị dịch vụ ngoài.
  2. Khi nhận hàng về -> Nghiệm thu kỹ thuật:
     - **Đạt yêu cầu:** Nhập lại **Kho Tổng** làm hàng sẵn sàng sử dụng (ghi nhận chi phí sửa vào giá trị tài sản).
     - **Không thể khắc phục:** Tự động điều chuyển sang luồng **Thanh lý phế liệu**.

### 4. Phân hệ Thanh Lý Phế Liệu & Ve Chai (`/liquidations`)
* **Mục đích:** Thu hồi vốn từ phế liệu kim loại, linh kiện không thể phục hồi, minh bạch số tiền ve chai.
* **Cách vận hành:**
  - Lập phiếu thanh lý -> Nhập số kg/số lượng và đơn giá bán ve chai cho thương lái.
  - Hệ thống xuất giảm tồn kho Kho Hỏng và hạch toán doanh thu thanh lý phế liệu.

### 5. Phân hệ Phiếu Yêu Cầu & Cấp Phát Xuất Kho (`/requisitions`, `/issues`)
* **Xuất cấp nội bộ:** Trưởng khu chuồng lập phiếu xin cấp vật tư định kỳ (bóng đèn sưởi, vỉ trứng, thuốc men) -> Quản lý duyệt -> Thủ kho soạn hàng giao -> Trưởng chuồng bấm xác nhận nhận hàng.
* **Xuất bán bên ngoài:** Xuất bán phân gà, vỉ trứng cũ hoặc phụ tùng cho khách hàng/thương lái kèm bảng giá và theo dõi công nợ.

### 6. Phân hệ Nhập Kho & Chứng Từ Hóa Đơn (`/receipts`)
* Ghi nhận nhập hàng từ các Nhà cung cấp, cập nhật đơn giá, lưu hình ảnh hóa đơn đỏ/phiếu giao hàng.
* Hỗ trợ vật tư dạng "Bộ/Combo" (ví dụ: 1 bộ quạt hút gồm vỏ quạt, cánh quạt, motor, dây curoa).

### 7. Phân hệ Kiểm Kê Kho & Cân Bằng Tự Động (`/stocktake`)
* Khởi tạo phiên kiểm kê theo từng kệ hàng hoặc toàn bộ kho.
* Quét mã QR đếm số lượng thực tế -> Hệ thống so khớp với số liệu sổ sách, cảnh báo chênh lệch thừa/thiếu.
* Khi Quản lý bấm duyệt, hệ thống tự động sinh các bút toán điều chỉnh cân bằng kho chính xác 100%.

### 8. Trung Tâm Báo Cáo & Phân Tích Đa Chiều (`/reports`)
* **Báo cáo Xuất - Nhập - Tồn (XNT):** Xem biến động tồn kho của từng mặt hàng theo khoảng ngày bất kỳ.
* **Báo cáo Chi phí theo Chuồng Trại:** Xem biểu đồ và bảng phân bổ chi phí vật tư của từng Khu/Dãy chuồng.
* **Báo cáo Tiêu hao Nhiên liệu:** Báo cáo tổng số lít dầu cấp cho từng xe và máy phát điện.
* **Xuất dữ liệu:** Hỗ trợ xuất file Excel chi tiết và In PDF A4/A5 chuẩn nhận diện thương hiệu trang trại.

---

## ⚡ PHẦN III: HIỆU NĂNG & NỀN TẢNG KỸ THUẬT

Hệ thống được tối ưu hóa toàn diện để đảm bảo tốc độ phản hồi cực nhanh trên mọi thiết bị:

1. **Tốc độ tải trang siêu tốc (~200ms/trang):**
   - Áp dụng **Next.js 15 Server Components (RSC)**: Server render sẵn giao diện, giảm tải tối đa cho điện thoại của công nhân.
   - **38 Chỉ mục Cơ sở dữ liệu (PostgreSQL Indexes):** Truy vấn có chỉ mục trên mọi cột trạng thái, ngày tháng, khu vực, người dùng.
   - **Bộ nhớ đệm Metadata (`src/lib/cached-metadata.ts`):** Danh mục chuồng trại, nhà cung cấp, kho bãi được lưu trong RAM server và phản hồi trong **0.1ms**, tự động cập nhật ngay khi admin thay đổi dữ liệu.
2. **Kiến trúc Tách biệt An toàn (Dual-Instance Architecture):**
   - **Web Production (Cổng 3000):** Được quản lý bởi dịch vụ `systemd mtp-web`, tự động khởi động cùng máy chủ, đảm bảo vận hành 24/7 liên tục và ổn định.
   - **Môi trường Dev (Cổng 3001):** Môi trường thử nghiệm tính năng mới độc lập, không làm gián đoạn hệ thống thực tế đang chạy.
3. **Chất lượng Mã Nguồn & Kiểm Thử:**
   - Đạt 100% Type-safety với TypeScript Strict Mode.
   - **55 file Unit & Integration Tests (318 bài test tự động)** đảm bảo mọi luồng nghiệp vụ không bao giờ bị lỗi hồi quy (regression).

---

## 🚀 PHẦN IV: KẾ HOẠCH MỞ RỘNG TIẾP THEO (SMART POULTRY ERP)

Để phát triển trang trại thành **Hệ sinh thái Quản trị Nông nghiệp Thông minh Toàn diện**, hệ thống đã có sẵn bản thiết kế (Spec) và kế hoạch (Plan) để mở rộng thêm 3 giai đoạn tiếp theo:

### Giai đoạn 1: Quản lý Đàn Gà & Thu hoạch Trứng Thương phẩm
- **Quản lý Đàn & Lứa gà theo Dãy chuồng:** Theo dõi ngày nhập, nguồn giống, số lượng gà sống và nhật ký gà chết/loại thải hằng ngày kèm nguyên nhân.
- **Nhật ký Thu nhặt & Phân loại Trứng:** Nhặt trứng theo ca sáng/chiều, phân loại (Trứng loại 1, loại 2, Jumbo, dập, méo, bẩn), tính toán tức thì tỷ lệ đẻ **% Laying Rate** của từng chuồng.
- **Quản lý Giá & Xuất bán Trứng:** Cập nhật bảng giá trứng thương phẩm theo ngày, tạo phiếu xuất bán cho thương lái/đại lý.

### Giai đoạn 2: Dinh dưỡng Thức ăn, FCR & Lịch Vắc-xin Thú y
- **Quản lý Tiêu thụ Cám & Chỉ số FCR:** Theo dõi định mức ăn g/con/ngày, tính chỉ số chuyển hóa thức ăn FCR (kg cám/kg trứng), phát hiện sớm dấu hiệu ăn giảm (cảnh báo ủ bệnh sớm).
- **Lịch Vắc-xin Tự động theo Tuần tuổi:** Tự động lên lịch nhắc tiêm/uống thuốc cho bác sĩ thú y.
- **Cảnh báo Thời gian Ngưng thuốc (Withdrawal Period):** Ngăn chặn xuất bán khi chưa hết hạn cách ly thuốc, đảm bảo an toàn sinh học.
- **Tự động liên kết Kho:** Tự động trừ tồn kho Cám và Thuốc trong Kho Tổng khi chuồng xuất dùng.

### Giai đoạn 3: Tài chính Nông trại, Giá thành 1 Quả Trứng & P&L Tổng thể
- **Báo cáo Giá thành Sản xuất 1 Quả Trứng (Cost per Egg):** Tính chính xác hôm nay làm ra 1 quả trứng tốn bao nhiêu đồng (Cám + Giống + Thuốc + Điện/Dầu + Vật tư + Nhân công).
- **Báo cáo Lãi/Lỗ ròng (P&L):** Doanh thu bán trứng/gà thải/phân trừ tổng chi phí thực tế theo ngày/tháng/lứa gà.
- **Chấm công & Thưởng Năng suất Chuồng:** Công thức tính thưởng cho công nhân (% đẻ cao, tỷ lệ chết thấp, tỷ lệ trứng dập vỡ thấp).

---

## 🛠️ PHẦN V: HƯỚNG DẪN KHỞI CHẠY & VẬN HÀNH

### 1. Khởi động môi trường phát triển (Dev)
```bash
# Cài đặt thư viện
pnpm install

# Khởi động toàn bộ môi trường dev (Supabase DB + Dev Server cổng 3001)
bash scripts/dev-up.sh
```

### 2. Kiểm tra chất lượng mã nguồn
```bash
pnpm typecheck    # Kiểm tra kiểu dữ liệu TypeScript
pnpm test         # Chạy toàn bộ 318 unit tests
pnpm lint         # Kiểm tra chuẩn cú pháp mã nguồn
```

### 3. Vận hành Web Production (Cổng 3000)
```bash
# Cập nhật code mới và deploy tự động sang production
bash scripts/deploy.sh

# Xem trạng thái dịch vụ production
systemctl status mtp-web

# Xem log hoạt động thời gian thực
journalctl -u mtp-web -f
```

---

## 📞 THÔNG TIN HỖ TRỢ & LIÊN HỆ

* **Đơn vị phát triển:** Antigravity Team
* **Đơn vị vận hành:** Trại Gà Đẻ Trứng Lê Văn Dương
* **Địa chỉ:** Ấp Tân Tiến, Xã Minh Tân, Huyện Dầu Tiếng, Tỉnh Bình Dương
* **Hotline hỗ trợ:** 0988 365 238 – 0963 077 879
