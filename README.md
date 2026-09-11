# MTP Farm ERP — Hệ Thống Quản Trị Kho, Nhiên Liệu & Vật Tư Trại Gà Minh Tân Phát
### (Đơn vị áp dụng thực tế: Trại Gà Đẻ Trứng Lê Văn Dương — Dầu Tiếng, Bình Dương)

![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%2B_Auth-3ecf8e?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)
![Performance](https://img.shields.io/badge/Tốc_độ_tải_trang-~200ms-success?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-Ngoại_tuyến_(Offline)-orange?style=flat-square)

---

## 🎯 TỔNG QUAN & MỤC ĐÍCH RA ĐỜI DỰ ÁN

Tại trang trại chăn nuôi gà đẻ trứng quy mô lớn, hoạt động vận hành thường ngày tiêu tốn hàng trăm loại vật tư cơ điện (motor quạt, béc phun, tấm làm mát, bóng sưởi, núm uống), vật tư thú y, thuốc sát trùng và hàng nghìn lít dầu Diesel cho dàn xe ben chở phân, xe xúc lật, máy phát điện.

Hệ thống **MTP Farm ERP** được nghiên cứu và phát triển trực tiếp từ thực tế vận hành tại trại, nhằm **xóa bỏ hoàn toàn cách quản lý thủ công bằng sổ sách giấy**, chấm dứt tình trạng **thất thoát vật tư - nhiên liệu**, và giải phóng trang trại khỏi sự **phụ thuộc hoàn toàn vào trí nhớ của một vài cá nhân**.

---

## 🔍 PHẦN I: NHỮNG BẤT CẬP THỰC TẾ TẠI TRẠI GÀ VÀ GIẢI PHÁP TRIỆT ĐỂ

### 1. Vấn đề: Quản lý kho chỉ ghi chép sổ sách giấy ➜ Thiếu kiểm soát, dễ mất mát
* **Thực trạng trước đây:** Mọi yêu cầu cấp vật tư, nhập hàng, xuất kho đều viết tay ra sổ hoặc xé giấy nháp. Sổ sách để ở kho bụi bặm, dễ ướt rách, thất lạc; cuối tháng cộng trừ thủ công rất lâu và hay nhầm lẫn số liệu.
* **Hệ thống giải quyết:**
  - **Số hóa 100% quy trình:** Toàn bộ phiếu yêu cầu, phiếu nhập, phiếu xuất, phiếu chuyển kho đều thao tác trên điện thoại/máy tính bảng.
  - **Sổ kho điện tử tự động (Realtime Ledger):** Mỗi khi xuất/nhập, số tồn kho tự động nhảy số tức thì, lưu vết chính xác ai làm, lúc mấy giờ, lý do gì.

---

### 2. Vấn đề: Giao nhận vật tư nội bộ thiếu bằng chứng, thiếu thông báo ➜ Hay cãi vã, thất thoát đồ
* **Thực trạng trước đây:** Thủ kho đưa đồ cho công nhân chuồng hoặc thợ điện cầm đi nhưng không có giấy tờ ký nhận, không chụp ảnh bàn giao. Đến khi kiểm kho thiếu hụt thì người giao bảo *"đã đưa rồi"*, người nhận bảo *"chưa nhận được"*, đổ lỗi qua lại, không quy được trách nhiệm.
* **Hệ thống giải quyết:**
  - **Quy trình Giao - Nhận 2 chiều minh bạch:**
    1. Trưởng chuồng tạo phiếu yêu cầu trên app $\rightarrow$ Quản lý duyệt.
    2. Thủ kho soạn hàng giao $\rightarrow$ Hệ thống gửi **Chuông thông báo (Notification) tức thì** đến người yêu cầu.
    3. Người nhận phải bấm nút **"Xác nhận đã nhận hàng"** trên app thì phiếu mới hoàn tất.
  - **Lưu trữ bằng chứng ảnh chụp:** Cho phép chụp ảnh giao nhận vật tư tại chỗ, lưu vĩnh viễn trên hệ thống để đối soát khi cần.

---

### 3. Vấn đề: Không có quy trình thu hồi đồ hỏng ➜ Chỉ phụ thuộc vào trí nhớ của quản kho
* **Thực trạng trước đây:** Quạt cháy hay bơm nước hỏng được đổi đồ mới đem đi lắp, nhưng đồ cũ hỏng không ai thu hồi hoặc vứt lăn lóc ở góc xưởng. Không ai biết có bao nhiêu motor đang hỏng, cái nào đã đem đi quấn lại, cái nào đã thành phế liệu. Mọi thứ chỉ nằm trong "đầu" của quản kho, nếu quản kho quên hoặc nghỉ việc là trại mất trắng dữ liệu.
* **Hệ thống giải quyết:**
  - **Quy trình Đổi 1-1 Bắt Buộc Thu Hồi (`/defects`):** Muốn lấy 1 motor mới, bắt buộc phải chụp ảnh motor hỏng và tạo phiếu đổi $\rightarrow$ Hệ thống tự động xuất 1 đồ mới từ **Kho Tổng** đi cứu chuồng và nạp 1 đồ hỏng vào **Kho Hỏng (Defect Location)**.
  - **Vòng đời thiết bị khép kín (Hỏng ➜ Gom Sửa ➜ Thanh Lý):**
    - Gom đồ hỏng gửi thợ ngoài sửa (`/repairs`): Nghiệm thu đạt $\rightarrow$ Nhập lại Kho Tổng sẵn sàng dùng tiếp.
    - Thiết bị nát không thể sửa: Chuyển sang **Thanh lý phế liệu (`/liquidations`)** ghi nhận số tiền bán ve chai nộp về quỹ trại.

---

### 4. Vấn đề: Đổ xăng, dầu, nhớt cho xe cơ giới thiếu quy trình ➜ Thất thoát & phụ thuộc quản kho
* **Thực trạng trước đây:** Trại có dàn xe ben chở phân, xe cuốc, xe xúc lật, xe bồn cám và máy phát điện. Mỗi lần tài xế cần đổ dầu là phải chạy đi tìm quản kho mở bồn, ghi sổ tay nguệch ngoạc. Không quản lý được Odo/giờ chạy, không biết xe nào chạy hao dầu bất thường, rất dễ bị rút trộm dầu.
* **Hệ thống giải quyết:**
  - **Trạm cấp dầu thông minh bằng Mã QR (`/fuel`):** Mỗi xe tải, xe xúc, máy phát điện được dán 1 **Tem QR chống nước**.
  - **Thao tác 5 giây:** Quét mã $\rightarrow$ Hệ thống tự nhận diện đúng xe, tên tài xế và số Odo/giờ máy lần trước $\rightarrow$ Nhập số lít thực đổ và số Odo mới.
  - **Tự động đo định mức & cảnh báo gian lận:** Tự động tính chỉ số tiêu hao ($L/100km$ với xe tải hoặc $L/giờ$ với máy xúc/máy phát). Báo động đỏ ngay lập tức nếu xe chạy tốn dầu bất thường.

---

### 5. Vấn đề: Mọi người không biết trong kho có những gì ➜ Bị phụ thuộc độc quyền vào Quản kho
* **Thực trạng trước đây:** Giám đốc, Kỹ thuật viên, Trưởng khu chuồng không ai nắm được trong kho còn bao nhiêu cái bóng đèn, bao nhiêu mét dây điện, còn phụ tùng thay thế không. Mọi việc từ to đến nhỏ đều phải gọi hỏi quản kho. Nếu quản kho vắng mặt, ốm, bận việc thì công việc đình trệ, không ai dám quyết định mua hay lấy đồ.
* **Hệ thống giải quyết:**
  - **Minh bạch Danh mục & Tồn kho cho toàn bộ đội ngũ (`/products`):** Mọi nhân viên có tài khoản đều có thể mở điện thoại xem danh mục vật tư có hình ảnh, thông số kỹ thuật, vị trí để ở kệ nào và số lượng còn trong kho là bao nhiêu.
  - **Tự chủ công việc:** Trưởng chuồng chủ động lên phiếu xin cấp đúng loại vật tư có sẵn; Phụ kho hoặc người trực thay có thể tra cứu và soạn hàng chính xác 100% mà không cần hỏi ai.

---

### 6. Vấn đề: Đơn đặt hàng từ nhà cung cấp về chỉ 1 mình Quản kho biết ➜ Phụ kho không hỗ trợ được
* **Thực trạng trước đây:** Hàng nhà cung cấp chở đến trại, đơn giá bao nhiêu, đặt mấy chục món, đã giao đủ hay thiếu chỉ có quản kho chính nắm. Nếu phụ kho ra nhận hàng giùm thì không biết đối chiếu với ai, dễ nhận thiếu hàng hoặc nhận sai quy cách.
* **Hệ thống giải quyết:**
  - **Số hóa Phiếu Nhập Kho & Hóa Đơn Nhà Cung Cấp (`/receipts`):**
    - Mọi đơn hàng nhập từ nhà cung cấp đều được lưu rõ chi tiết: số lượng, đơn giá, người giao, xe giao.
    - Chụp ảnh đính kèm phiếu giao hàng / hóa đơn đỏ của nhà cung cấp lên hệ thống.
    - Ban Giám đốc và Phụ kho đều có thể cùng truy cập để kiểm tra, đối chiếu chéo số lượng thực nhận bất kỳ lúc nào.

---

## 🏗️ PHẦN II: TỔNG HỢP CÁC TÍNH NĂNG ĐÃ HOÀN THIỆN TRONG REPO

| Phân hệ | Đường dẫn | Chức năng chính | Giá trị mang lại |
|---|:---:|---|---|
| **Kho Vật Tư** | `/products` | Tra cứu vật tư có hình ảnh, phân loại danh mục, thông số, tồn kho khả dụng realtime. | Minh bạch thông tin, không bị phụ thuộc vào trí nhớ cá nhân. |
| **Yêu Cầu Vật Tư** | `/requisitions` | Tạo phiếu xin cấp vật tư dạng giỏ hàng, phân quyền duyệt, gửi chuông thông báo 2 chiều. | Chấm dứt viết giấy nháp, giao nhận có người nhận bấm xác nhận. |
| **Nhập Kho NCC** | `/receipts` | Nhập hàng từ Nhà cung cấp, lưu đơn giá, chụp ảnh lưu chứng từ hóa đơn. | Quản lý giá nhập, phụ kho chủ động kiểm tra đơn hàng cùng quản kho. |
| **Xuất Kho Nội Bộ/Bán** | `/issues` | Xuất cấp vật tư cho từng Khu chuồng hoặc Xuất bán phân gà/vỉ trứng cho khách ngoài. | Phân bổ chính xác chi phí đến từng dãy chuồng, quản lý công nợ. |
| **Báo Hỏng & Đổi 1-1** | `/defects` | Chụp ảnh hỏng, đổi đồ mới trong 30 giây, tự động thu hồi đồ cũ vào Kho Hỏng. | Cứu chuồng gà ngạt quạt cấp tốc, không thất lạc linh kiện hỏng. |
| **Sửa Chữa Thiết Bị** | `/repairs` | Gom thiết bị hỏng đi quấn motor, lưu chi phí sửa, nghiệm thu đạt trả về Kho Tổng. | Tối ưu chi phí tái sử dụng, kiểm soát việc thợ đem đồ ra ngoài sửa. |
| **Thanh Lý Phế Liệu** | `/liquidations` | Lập phiếu bán ve chai/phế liệu kim loại, ghi nhận doanh thu thanh lý. | Minh bạch dòng tiền phế liệu, dọn sạch kho bãi. |
| **Cấp Dầu & Xe Cơ Giới**| `/fuel` | Quét mã QR xe/máy phát 5 giây, đo Odo/giờ chạy, tính định mức tiêu hao lít/100km. | Chống thất thoát xăng dầu, cảnh báo xe chạy hao dầu bất thường. |
| **Kiểm Kê Kho Tự Động** | `/stocktake` | Kiểm đếm theo dãy kệ quét QR, đối chiếu chênh lệch và tự cân bằng tồn kho. | Kiểm kho nhanh gấp 5 lần, phát hiện ngay thất thoát. |
| **Trung Tâm Báo Cáo** | `/reports` | Báo cáo Xuất-Nhập-Tồn, Báo cáo chi phí từng chuồng trại, xuất file Excel, in PDF A4/A5. | Cung cấp số liệu chính xác để Giám đốc ra quyết định kinh doanh. |
| **PWA Ngoại Tuyến** | Toàn app | Hoạt động bình thường cả khi mất mạng ở góc chuồng xa, tự động đồng bộ khi có sóng. | Không bị gián đoạn công việc thực địa. |

---

## ⚡ PHẦN III: HIỆU NĂNG TỐC ĐỘ & ĐỘ ỔN ĐỊNH HỆ THỐNG

* **Tốc độ phản hồi cực nhanh (~200ms/trang):**
  - Toàn bộ 38 chỉ mục (Indexes) đã được tối ưu hóa trong PostgreSQL.
  - Danh mục chuồng trại, nhà cung cấp, vị trí kho được lưu đệm trong RAM Server (`src/lib/cached-metadata.ts`) phản hồi trong **0.1ms**.
* **Vận hành an toàn 24/7 (Dual-Instance Architecture):**
  - **Web Production (Cổng 3000):** Được quản lý bởi dịch vụ hệ thống `systemd mtp-web`, tự khởi động lại khi bật máy tính, vận hành bền bỉ.
  - **Môi trường Dev (Cổng 3001):** Dùng để phát triển tính năng mới độc lập, không ảnh hưởng đến người đang dùng thật.
* **Độ tin cậy cao:** Đạt 100% Type-safety, vượt qua **55 file test tự động (318 unit tests)**.

---

## 🚀 PHẦN IV: HƯỚNG MỞ RỘNG TIẾP THEO (POULTRY ERP EXPANSION)

Sau khi ổn định toàn bộ khâu Hậu cần - Vật tư - Nhiên liệu, hệ thống đã có sẵn bản Kế hoạch (Plan) và Thiết kế (Spec) để mở rộng tiếp thành ERP Trại Gà Toàn Diện:

```
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 1: QUẢN LÝ ĐÀN GÀ & THU HOẠCH TRỨNG THƯƠNG PHẨM              │
│ - Quản lý lứa gà theo từng dãy chuồng, theo dõi gà chết & loại thải    │
│ - Nhật ký nhặt trứng theo ca sáng/chiều, phân loại (loại 1, 2, dập...) │
│ - Tính tức thì % Tỷ lệ đẻ (% Laying Rate) của từng chuồng              │
│ - Xuất bán trứng cho thương lái & Quản lý bảng giá trứng theo ngày     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2: THỨC ĂN, CHỈ SỐ FCR & LỊCH THÚ Y VẮC-XIN TỰ ĐỘNG          │
│ - Quản lý cấp cám, định mức g/con/ngày, chỉ số FCR (kg cám / kg trứng) │
│ - Cảnh báo ăn giảm sớm (phát hiện dấu hiệu ủ bệnh trước khi sụt đẻ)    │
│ - Lịch vắc-xin tự động theo tuần tuổi, cảnh báo thời gian ngưng thuốc  │
│ - Tự động liên kết trừ tồn kho cám & thuốc trong Kho vật tư            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3: TÀI CHÍNH NÔNG TRẠI, GIÁ THÀNH 1 QUẢ TRỨNG & LÃI/LỖ P&L    │
│ - Báo cáo Giá thành sản xuất 1 quả trứng (Cost per Egg) theo ngày      │
│ - Báo cáo P&L Doanh thu - Chi phí toàn trại & từng lứa gà              │
│ - Chấm công ca nhặt trứng & Công thức tính thưởng năng suất chuồng     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ PHẦN V: HƯỚNG DẪN VẬN HÀNH NHANH

```bash
# 1. Khởi động môi trường phát triển (Dev 3001):
bash scripts/dev-up.sh

# 2. Kiểm tra chất lượng code & chạy test:
pnpm typecheck
pnpm test

# 3. Cập nhật và phát hành Web Production (Prod 3000):
bash scripts/deploy.sh

# 4. Giám sát trạng thái & xem log production:
systemctl status mtp-web
journalctl -u mtp-web -f
```

---

## 📞 THÔNG TIN LIÊN HỆ & BẢN QUYỀN

* **Đơn vị phát triển:** Đội ngũ Kỹ thuật Antigravity
* **Đơn vị vận hành áp dụng:** Trại Gà Đẻ Trứng Lê Văn Dương
* **Địa chỉ:** Ấp Tân Tiến, Xã Minh Tân, Huyện Dầu Tiếng, Tỉnh Bình Dương
* **Hotline hỗ trợ kỹ thuật:** 0988 365 238 – 0963 077 879
