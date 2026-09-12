# 🐔 MTP Farm ERP — Hệ Thống Quản Trị Toàn Diện Trại Gà Minh Tân Phát
### Đơn vị áp dụng thực tế: Trang Trại Gà Đẻ Trứng Lê Văn Dương (Minh Tân, Dầu Tiếng, Bình Dương)

![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x_(Strict)-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17_%2B_RLS-3ecf8e?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)
![Performance](https://img.shields.io/badge/Tốc_độ_tải_trang-~200ms-success?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-Offline_Ready-orange?style=flat-square)
![Tests](https://img.shields.io/badge/Automated_Tests-318_Passed-brightgreen?style=flat-square)

---

## 💡 KHÁI NIỆM & BẢN CHẤT ERP TRONG QUẢN TRỊ DOANH NGHIỆP

**ERP** (viết tắt của **Enterprise Resource Planning** - Hoạch định Nguồn lực Doanh nghiệp) là hệ thống phần mềm tích hợp đa chức năng, giúp doanh nghiệp quản lý và đồng bộ toàn bộ quy trình vận hành cốt lõi trên **một cơ sở dữ liệu duy nhất theo thời gian thực**.

Thay vì kế toán dùng phần mềm riêng, kho dùng bảng Excel riêng, phòng kinh doanh dùng một công cụ khác, ERP gom tất cả các phòng ban về chung một mối:

### Các phân hệ chính trong một hệ thống ERP tiêu chuẩn:
* **Tài chính - Kế toán (Financial Management):** Quản lý dòng tiền, sổ cái, công nợ phải thu/phải trả, báo cáo tài chính và thuế.
* **Quản lý kho & Chuỗi cung ứng (SCM & Inventory):** Theo dõi xuất - nhập - tồn, điều chuyển kho nội bộ, theo dõi đơn đặt mua nguyên vật liệu và quản lý nhà cung cấp.
* **Sản xuất (Manufacturing):** Lập kế hoạch sản xuất, định mức nguyên vật liệu (BOM), theo dõi tiến độ phân xưởng và tính giá thành sản phẩm.
* **Bán hàng & CRM:** Quản lý đơn đặt hàng, báo giá, hợp đồng, xuất hóa đơn và thông tin khách hàng.
* **Nhân sự & Tiền lương (HRM):** Chấm công, tính lương thưởng, hồ sơ nhân viên và KPI.

### Lợi ích cốt lõi:
* **Dữ liệu liền mạch (Single Source of Truth):** Khi nhân viên kinh doanh chốt một đơn hàng, hệ thống tự động trừ tồn kho, gửi thông báo cho phân xưởng sản xuất và ghi nhận doanh thu vào bộ phận kế toán mà không cần nhập liệu thủ công qua lại giữa các phòng ban.
* **Giảm thiểu sai sót & Minh bạch:** Loại bỏ tình trạng lệch số liệu giữa các phòng ban hoặc gian lận thất thoát.
* **Hỗ trợ ra quyết định nhanh:** Ban lãnh đạo xem được báo cáo doanh thu, chi phí, tồn kho tổng thể theo thời gian thực (real-time).

---

## 🎯 ỨNG DỤNG ERP VÀO TRẠI GÀ ĐẺ TRỨNG MINH TÂN PHÁT

Áp dụng triết lý ERP vào thực tế trang trại chăn nuôi gà đẻ trứng quy mô lớn, **MTP Farm ERP** số hóa toàn diện từ quản lý kho bãi, vật tư cơ điện chuồng trại, cấp phát nhiên liệu xăng dầu cho xe cơ giới và máy phát điện dự phòng, phân quyền người dùng, thông báo chuông tức thì đến từng nhân viên, kiểm soát chi phí thực tế theo từng dãy chuồng.

---

## 📦 TOÀN BỘ CÁC TÍNH NĂNG CỦA HỆ THỐNG

### 1. 👥 Phân Cấp Người Dùng & Quản Trị Tài Khoản (`/admin/users`)
* **3 Cấp độ Phân quyền chặt chẽ:**
  * **`requester` (Trưởng chuồng, Thợ cơ điện, Tài xế, Công nhân):** Tra cứu danh mục, tạo phiếu yêu cầu vật tư, báo hỏng đổi đồ 1-1, xác nhận đã nhận hàng. Được gắn trực tiếp với Khu vực (`zone_id`) và Dãy chuồng (`sub_zone_id`) phụ trách.
  * **`manager` (Thủ kho, Quản lý trại, Kế toán):** Toàn quyền duyệt cấp phát, xuất/nhập kho, đổi 1-1 cấp tốc, quản lý sửa chữa, thanh lý, nhập bồn dầu, kiểm kê kho, quản lý danh mục xe và giá cả.
  * **`superuser` (Chủ trại, Ban Giám đốc):** Quyền tối cao: Tạo mới, khóa/kích hoạt tài khoản, đổi mật khẩu nhân viên, phân quyền vai trò, xem toàn bộ báo cáo doanh thu & chi phí lãi/lỗ.
* **Đăng nhập bằng Tên tài khoản (Username Auth):** Đăng nhập nhanh bằng username ngắn gọn (`thukho_dung`, `truongchuong_tuan`), không cần email phức tạp.

### 2. 🔔 Hệ Thống Thông Báo Chuông Tức Thì (Realtime Notifications)
* **Chuông thông báo đích danh tới từng người:**
  * Thông báo cho **Trưởng chuồng/Người yêu cầu** khi: Phiếu yêu cầu được Duyệt / Từ chối / Thủ kho đã xuất hàng giao.
  * Thông báo cho **Quản lý / Thủ kho** khi: Có phiếu yêu cầu mới cần duyệt / Có phiếu báo hỏng khẩn cấp / Có xe đổ dầu tiêu hao bất thường.
  * Thông báo nhắc nhở khi: Có dụng cụ đồ nghề mượn quá hạn chưa trả.
* **Cơ chế xác nhận 2 chiều:** Khi nhận hàng, người nhận bắt buộc bấm nút **"Xác nhận đã nhận đủ hàng"** trên app để hoàn tất phiếu, chống cãi vã và thất thoát.

### 3. 🔍 Danh Mục Vật Tư & Phụ Tùng Đa Biến Thể (`/products`, `/admin/products`)
* Tra cứu vật tư trực quan có hình ảnh thực tế, thông số kỹ thuật, vị trí lưu ở kệ nào và số lượng tồn khả dụng.
* **Đa biến thể linh hoạt:** Hỗ trợ sản phẩm có nhiều quy cách (công suất kW/HP, điện áp 220V/380V, kích cỡ, hãng sản xuất).
* **Vật tư theo bộ (Composite Kits):** Khai báo 1 bộ quạt hút (gồm khung quạt, cánh, motor, pully, dây curoa) ➜ Cho phép xuất nguyên bộ hoặc xuất lẻ từng linh kiện.
* **Cảnh báo tồn kho tối thiểu (Min/Max Stock):** Đổi màu cảnh báo vàng/đỏ khi số lượng tồn kho xuống dưới mức an toàn.

### 4. 📝 Phiếu Yêu Cầu & Cấp Phát Xuất Kho (`/requisitions`, `/issues`)
* **Giao diện Giỏ hàng:** Chọn vật tư xin cấp như mua sắm online trên điện thoại; hỗ trợ làm phiếu thay cho công nhân không có smartphone.
* **Quy trình duyệt chuẩn 4 bước:** Nháp ➜ Chờ duyệt ➜ Đã xuất hàng ➜ Người nhận xác nhận đã nhận đủ.
* **Xuất cấp nội bộ:** Gắn đích xuất cụ thể theo từng Khu chuồng (`Zone`) và Dãy chuồng (`Sub-zone`).
* **Xuất bán bên ngoài:** Xuất bán phân gà, vỉ trứng cũ hoặc phế liệu cho khách hàng/thương lái có lưu giá và công nợ.

### 5. ⚡ Báo Hỏng & Đổi Mới 1-1 Cấp Tốc Trong 30 Giây (`/defects`)
* Chụp ảnh vật tư hư hỏng tại chuồng (motor quạt, máy bơm, núm uống...), chọn mức độ hỏng.
* Bấm 1 chạm **"Đổi 1-1 Cấp Tốc"**: Hệ thống tự động xuất 1 món mới từ **Kho Tổng** đi lắp ngay cứu chuồng gà ngạt thở, đồng thời nạp 1 món cũ vào **Kho Hỏng**.

### 6. 🔄 Vòng Đời Thiết Bị: Sửa Chữa & Thanh Lý Phế Liệu (`/repairs`, `/liquidations`)
* **Gom sửa chữa (`/repairs`):** Gom các motor cháy, máy bơm hỏng gửi thợ ngoài quấn lại, ghi nhận chi phí sửa.
* **Nghiệm thu kỹ thuật:** Đạt chuẩn ➜ Nhập lại **Kho Tổng** tái sử dụng; Nát quá không sửa được ➜ Chuyển Thanh lý phế liệu.
* **Thanh lý ve chai (`/liquidations`):** Lập phiếu bán phế liệu sắt nhôm cho thương lái, ghi nhận doanh thu thanh lý nộp về quỹ trại.

### 7. 🧰 Mượn - Trả Dụng Cụ & Đồ Nghề Chuyên Dụng (`/tools`)
* Quản lý danh mục đồ nghề đắt tiền: Máy hàn Inverter, máy mài, máy xịt rửa cao áp, kìm bấm cáp, đồng hồ vạn năng, thang nhôm.
* Theo dõi chi tiết ai đang mượn, mượn ngày nào, hạn trả, dùng ở chuồng nào; cảnh báo quá hạn mượn (Overdue alerts).

### 8. ⛽ Quản Lý Trạm Cấp Dầu & Xe Cơ Giới (`/fuel`, `/fuel/scan`, `/admin/vehicles`)
* Quản lý danh mục dàn xe ben chở phân, xe xúc lật dọn chuồng, xe bồn cám, xe tải chở trứng, máy phát điện Cummins 250kVA.
* **Nhập bồn dầu tổng (`/fuel/receipts`):** Ghi nhận xe bồn Petrolimex vào nhập dầu, lưu hóa đơn, theo dõi tồn và hao hụt bồn chứa.
* **Quét mã QR 5 giây (`/fuel/scan`):** Quét tem QR dán trên xe ➜ Tự nhận diện xe & Odo cũ ➜ Nhập số lít và Odo mới ➜ Tự động tính định mức tiêu hao ($L/100km$ hoặc $L/giờ$) và báo động đỏ nếu hao dầu bất thường.

### 9. 📥 Nhập Kho Nhà Cung Cấp & Lưu Hóa Đơn Chứng Từ (`/receipts`, `/admin/suppliers`)
* Quản lý danh bạ Nhà cung cấp thiết bị điện, quạt, thuốc men, xăng dầu.
* Nhập kho vật tư, cập nhật đơn giá vốn, chụp ảnh hóa đơn đỏ / phiếu giao hàng đính kèm lên phiếu để đối soát chéo.

### 10. 🏷️ Quản Lý Cấu Trúc Khu Vực & Dãy Chuồng (`/admin/zones`)
* Phân cấp 2 tầng: **Khu vực lớn (`zones`)** (Khu A, Khu B, Khu Úm, Xưởng Cơ Điện, Trạm Dầu) ➜ **Dãy chuồng chi tiết (`sub_zones`)** (Chuồng A1, Chuồng A2, Dãy B1, Dãy B2...).
* Phân bổ chi phí và thống kê vật tư chính xác đến từng dãy chuồng.

### 11. 🏢 Quản Lý Đa Vị Trí Kho & Điều Chuyển Nội Bộ (`/admin/locations`, `/transfers`)
* Quản lý các phân vùng kho: **Kho Chính (Main Stock)**, **Kho Hỏng (Defect)**, **Kho Đang sửa (Repair)**, **Kho Dự phòng (Backup)**.
* Điều chuyển nội bộ linh hoạt giữa các kho với đầy đủ nhật ký luân chuyển (Stock Movements).

### 12. 📋 Kiểm Kê Kho Tự Động & Cân Bằng Tồn Kho (`/stocktake`)
* Khởi tạo phiên kiểm kê theo từng dãy kệ hoặc toàn bộ kho.
* Quét mã QR đếm số lượng thực tế, hiển thị trực quan thừa/thiếu, tự động tạo bút toán cân bằng tồn kho khi duyệt.

### 13. 📊 Trung Tâm Báo Cáo, Thẻ Kho & In Ấn Chuẩn Hóa (`/reports`)
* **Báo cáo Xuất - Nhập - Tồn (XNT):** Xem biến động xuất nhập tồn theo khoảng ngày.
* **Thẻ kho (Stock Card):** Truy vết chi tiết lịch sử vào/ra của từng món đồ.
* **Báo cáo Chi phí theo Chuồng Trại:** Bảng biểu và biểu đồ phân bổ chi phí vật tư, điện, dầu theo từng Khu/Dãy chuồng (`Zone Costing`).
* **Xuất dữ liệu & In ấn:** Xuất file Excel chi tiết; In PDF A4/A5 chuẩn nhận diện thương hiệu Trại Gà Lê Văn Dương có logo, mã QR tra cứu và chữ ký 4 bên.

### 14. 🛡️ Nhật Ký Hệ Thống & Kiểm Soát Trách Nhiệm (Audit Trail - `/dashboard`)
* Ghi lại 100% mọi hành động (Tạo, Sửa, Xóa, Duyệt, Hủy, Đổi 1-1, Cân bằng kho).
* Lưu chi tiết: Ai làm, lúc mấy giờ, dữ liệu trước khi sửa (Before) và sau khi sửa (After), địa chỉ IP.

### 15. 📱 Trải Nghiệm Thực Địa & Công Nghệ Nền Tảng
* **Tốc độ siêu tốc (~200ms/trang):** Áp dụng Next.js 15 Server Components + 38 Database Indexes + RAM Cache Metadata.
* **Ngoại tuyến (Offline PWA):** Thao tác bình thường cả khi mất sóng ở góc chuồng xa, tự đồng bộ khi có mạng lại.
* **Mã QR toàn diện:** In mã QR dán trên kệ hàng, xe cơ giới, máy phát điện và trên từng phiếu in PDF.

---

## 🚀 ĐỊNH HƯỚNG MỞ RỘNG ERP TOÀN DIỆN (POULTRY ERP ROADMAP)

Hệ thống đã có sẵn bản Kế hoạch (Plan) và Thiết kế (Spec) trong thư mục `docs/superpowers/` để sẵn sàng mở rộng tiếp 3 giai đoạn:

* **Giai đoạn 1 (Sản lượng & Đàn gà):** Quản lý lứa gà theo từng dãy chuồng, theo dõi gà chết & loại thải hằng ngày, nhật ký thu nhặt trứng theo ca (sáng/chiều), phân loại trứng (loại 1, loại 2, dập...), tính tức thì tỷ lệ đẻ **% Laying Rate**, quản lý bảng giá và xuất bán trứng cho thương lái.
* **Giai đoạn 2 (Thức ăn & Thú y):** Quản lý tiêu thụ Cám (g/con/ngày), tính chỉ số chuyển hóa **FCR** (kg cám / kg trứng), cảnh báo ăn giảm sớm (báo động ủ bệnh trước khi sụt đẻ), lịch Vắc-xin tự động theo tuần tuổi, cảnh báo thời gian ngưng thuốc cách ly an toàn sinh học.
* **Giai đoạn 3 (Tài chính Nông trại):** Báo cáo **Giá thành sản xuất 1 quả trứng (Cost per Egg)** theo ngày, Báo cáo Lãi/Lỗ ròng (P&L) toàn trại, Chấm công ca nhặt trứng & Thưởng năng suất chuồng.

---

## 🛠️ HƯỚNG DẪN KHỞI CHẠY

```bash
# 1. Khởi động môi trường phát triển (Dev 3001):
bash scripts/dev-up.sh

# 2. Kiểm tra chất lượng mã nguồn & chạy 318 bài test tự động:
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
