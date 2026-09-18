# 📖 HƯỚNG DẪN 02: QUẢN LÝ DANH MỤC VẬT TƯ & QUY CÁCH BIẾN THỂ ĐA TẦNG

Hướng dẫn chi tiết cách khai báo, quản lý và thao tác chọn vật tư trên 4 trường hợp danh mục (Vật tư lẻ, Quy đổi đóng gói, Biến thể đa tầng và Bộ lắp ráp) cùng công nghệ chọn thông minh & mã QR.

---

## 1. TỔNG QUAN 4 TRƯỜNG HỢP QUẢN LÝ VẬT TƯ

Hệ thống phân định rõ ràng 4 mô hình quản lý vật tư để tránh nhầm lẫn số liệu và tối ưu thao tác:

| Trường hợp | Đặc điểm nhận diện | Ví dụ điển hình | Cơ chế quản lý tồn kho |
| :--- | :--- | :--- | :--- |
| **TH1: Vật tư Lẻ (Đơn quy cách)** | Chỉ có đúng 1 đơn vị, không có biến thể | Quạt hút 1.1kW, Bóng sưởi 175W, Thang nhôm | Quản lý theo 1 số lượng tồn duy nhất |
| **TH2: Quy đổi Đóng gói (Unit Conversion)** | Cùng 1 vật tư nhưng nhập/xuất theo nhiều cấp bao bì | Keo dán bạt (Hộp 550ml / Thùng 6 hộp), Thuốc (Lít / Can 5L) | 1 SKU gốc (Base Unit) + Tự động nhân/chia tỷ lệ quy đổi |
| **TH3: Biến thể Kỹ thuật Đa tầng (Multi-tier Variants)** | Khác nhau về Hãng, Kích cỡ, Mã số, Thông số | Bạc đạn (SKF / Koyo mã 6203, 6204), Bu lông (M6x20, M8x30) | Mỗi biến thể là 1 SKU riêng, có mã tem nhãn & tồn kho độc lập |
| **TH4: Bộ Lắp ráp / Combo (Kit / BOM)** | 1 Bộ được ghép từ nhiều linh kiện cơ khí rời | Bộ súng xịt áp lực (1 Súng + 10m Dây + 1 Khớp nối) | Tồn kho bộ tự tính theo linh kiện con còn ráp được |

---

## 2. HƯỚNG DẪN CHỌN VẬT TƯ NHIỀU BIẾN THỂ (CHO NHÂN VIÊN / TỔ THỢ)

Khi bấm vào một vật tư có nhiều quy cách (VD: *Bạc đạn công nghiệp*), popup chi tiết cung cấp **2 Chế độ chọn thông minh**:

### 🔹 Chế độ 1: "Chọn 1 quy cách" (E-Commerce Cascading Chips — Giống Shopee/Lazada)
Phù hợp khi bạn chỉ cần lấy **1 loại kích cỡ/thông số cụ thể**:

* **Giao diện phân tầng trực quan:**
  * **Hãng sản xuất:** `[ SKF ]` `[ Koyo ]` `[ NSK ]`
  * **Mã vòng bi:** `[ 6203 ]` `[ 6204 ]` `[ 6305 ]` *(chỉ hiện các mã thuộc hãng đang chọn)*
  * **Loại nắp:** `[ 2RS (Cao su) ]` `[ ZZ (Sắt) ]` `[ Hở ]`
* **Các bước thực hiện:**
  1. Bấm chọn **Hãng sản xuất** (VD: `SKF`).
  2. Bấm chọn **Mã kích thước** (VD: `6203`). Hệ thống chỉ hiển thị các mã mà SKF thực sự có.
  3. Bấm chọn **Loại nắp/Tiêu chuẩn** (VD: `2RS`).
  4. Điều chỉnh số lượng cần lấy -> Bấm **"Thêm vào giỏ yêu cầu"** hoặc **"Tạo phiếu yêu cầu ngay"**.
* *Lưu ý:* Khi bạn chuyển từ `SKF` sang `Koyo`, hệ thống giữ nguyên mã `6203` và tự khớp sang đúng biến thể `Koyo 6203` mà không bị mất lựa chọn.

---

### 🔹 Chế độ 2: "Chọn nhiều quy cách" (B2B Batch Matrix Order)
Phù hợp cho tổ thợ, lái xe hoặc quản kho khi cần **lấy nhiều kích cỡ cùng một lúc** *(VD: vừa lấy 10 con SKF 6203, vừa lấy 5 con Koyo 6203, vừa lấy 8 con SKF 6204)*:

* **Giao diện bảng nhập hàng loạt:**
  * **Thanh lọc theo Hãng:** `[ Tất cả (20) ]` `[ 🏷️ SKF (8) ]` `[ 🏷️ Koyo (7) ]` `[ 🏷️ NSK (5) ]`
  * **Ô tìm kiếm nhanh:** Gõ `6203`, `2RS`, mã SKU để lọc ngay.
  * **Danh sách gom nhóm theo Hãng:** Hiển thị từng nhóm hãng rõ ràng kèm ô nhập số lượng `[-] [ Số lượng ] [+]`.
* **Các bước thực hiện:**
  1. Bấm nút chuyển sang **"Chọn nhiều quy cách"**.
  2. Dùng tab lọc theo Hãng (`[ SKF ]`, `[ Koyo ]`) hoặc gõ vào ô tìm kiếm để lọc nhanh.
  3. Nhập số lượng trực tiếp cho từng dòng quy cách cần lấy.
  4. Bấm **"Thêm X quy cách vào giỏ"** -> Hệ thống đưa toàn bộ các món đã nhập vào giỏ yêu cầu chỉ với 1 lần bấm!

---

## 3. HƯỚNG DẪN KHAI BÁO & TẠO VẬT TƯ (DÀNH CHO QUẢN TRỊ / QUẢN KHO)

* **Truy cập:** Menu **Quản trị** -> **Vật tư** (`/admin/products`) -> Bấm **"Thêm vật tư mới"**.

### Quy trình khai báo vật tư có nhiều biến thể (TH3):
1. **Thông tin chung:** Nhập Tên vật tư (VD: *Bạc đạn công nghiệp*), chọn Danh mục (Cơ kim khí) và tải ảnh đại diện.
2. **Khai báo Nhóm lựa chọn (Option Axes):**
   * Khai báo theo thứ tự phân cấp, tối đa 3 trục.
   * *Ví dụ:* Nhóm 1: `Hãng sản xuất` -> Nhóm 2: `Mã vòng bi` -> Nhóm 3: `Loại nắp`.
3. **Khai báo các dòng biến thể thực tế:**
   * Thêm các tổ hợp thực tế đang có:
     * Dòng 1: `SKF` · `6203` · `2RS (Cao su)` | Mã SKU: `BD-SKF-6203-2RS` | ĐVT: `Cái` | Tồn tối thiểu: `10`
     * Dòng 2: `SKF` · `6203` · `ZZ (Sắt)` | Mã SKU: `BD-SKF-6203-ZZ` | ĐVT: `Cái` | Tồn tối thiểu: `5`
     * Dòng 3: `Koyo` · `6203` · `2RS (Cao su)` | Mã SKU: `BD-KOYO-6203-2RS` | ĐVT: `Cái` | Tồn tối thiểu: `10`
   * *Hệ thống tự động kiểm tra:* Chặn trùng lặp tổ hợp hoặc bỏ trống thông tin bắt buộc.

### Quy trình khai báo Quy đổi đơn vị (TH2):
1. Khai báo **Đơn vị cơ sở (Base Unit):** VD `ml` hoặc `Hộp`.
2. Khai báo **Đơn vị đóng gói quy đổi:** VD `Thùng` với tỷ lệ quy đổi `= 6 Hộp` hoặc `= 3300 ml`.

---

## 4. TRA CỨU & QUÉT MÃ QR TẠI KHO

1. **In mã QR định danh:**
   * Trong màn hình quản trị hoặc danh mục, mỗi biến thể/quy cách có mã QR độc lập.
   * In tem dán lên từng khay, ngăn kệ hoặc bao bì vật tư.
2. **Quét QR xuất/nhập/kiểm kê:**
   * Mở ứng dụng trên điện thoại -> Bấm biểu tượng **Camera QR** trên thanh tìm kiếm.
   * Hướng camera vào tem QR -> Màn hình mở ngay thông tin chính xác của biến thể đó (đúng hãng, đúng kích cỡ) kèm số lượng tồn kho theo thời gian thực.
