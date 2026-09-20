# 📖 HƯỚNG DẪN 09: TRẠM BỒN DẦU NỘI BỘ & QUẢN LÝ XE CƠ GIỚI (CẤP DẦU ĐA CHẾ ĐỘ & QUÉT QR 5 GIÂY)

Quy trình quản lý nhập bồn dầu Petrolimex, cấp phát dầu Diesel cho xe ben xúc phân, xe xúc lật, xe bồn cám, máy phát điện; cấp dầu theo toàn khu/dãy trại; tự động tính định mức tiêu hao (Lít/100km hoặc Lít/Giờ máy) nhằm chống rút trộm nhiên liệu và quản lý giấy tờ đăng kiểm xe.

---

## 1. QUY TRÌNH ĐỔ DẦU BẰNG MÃ QR (Quản kho dầu / Tài xế)

```
  [1. Xe đến trạm bồn] ──► [2. Quét mã QR trên cabin xe] ──► [3. Nhập số Lít & số ODO hiện tại] ──► [4. Hệ thống tự động tính Lít/100km hoặc Lít/h]
```

1. **Bước 1:** Quản kho dầu hoặc Tài xế mở mục **Quét mã QR Dầu** (`/fuel/scan`) trên điện thoại.
2. **Bước 2:** Hướng camera vào **Tem QR dán trên nắp bình dầu hoặc kính lái cabin xe**.
3. **Bước 3:** Màn hình tự động nhận diện ngay trong 1 giây:
   * Tên xe & Biển số: `Xe ben Howo 4 chân - 61C-123.45`
   * Khu vực & Dãy trại phụ trách: `Khu A - Trại A1, A2`
   * Tài xế phụ trách: `Mạnh Đức`
   * Loại nhiên liệu: `Dầu DO 0.05S`
   * Số ODO / Giờ máy & Lượng dầu lần đổ trước: `125,400 km (đổ 50L)`.
4. **Bước 4:** Bơm dầu vào xe và nhập:
   * **Số lít thực bơm:** Ví dụ `50` lít.
   * **Số ODO hiện tại trên đồng hồ xe:** Ví dụ `125,750` km.
   * **Chụp ảnh công tơ mét:** Bắt buộc chụp ảnh đồng hồ công tơ mét để chống gian lận.
5. **Bước 5:** Bấm **"Xác nhận cấp dầu"**.

---

## 2. CHẾ ĐỘ CẤP DẦU CHO TOÀN KHU & NHIỀU DÃY TRẠI (`dispense_type = 'zone'`)

Trong trường hợp cấp dầu cho máy phát điện khẩn cấp, máy bơm nước công suất lớn hoặc xe phục vụ chung cho nhiều dãy trại:
1. Mở modal **Cấp dầu mới** tại `/fuel`.
2. Chọn loại cấp phát: **"Cấp cho toàn khu / Dãy trại"** (`dispense_type = 'zone'`).
3. Chọn **Khu vực lớn** (`zone_id`) và **Dãy trại cụ thể** (`sub_zone_id`).
4. Nhập số lít thực cấp và đính kèm ảnh đồng hồ bồn cấp.
5. Hệ thống ghi nhận chi phí nhiên liệu phân bổ trực tiếp vào chi phí vận hành của Dãy trại đó trên Báo cáo tài chính và Views Metabase BI.

---

## 3. KẾT QUẢ TÍNH ĐỊNH MỨC & CẢNH BÁO TỰ ĐỘNG
* Bồn dầu tổng trừ ngay số lít đã cấp vào sổ cái `fuel_movements`.
* Hệ thống tính: Quãng đường chạy = $125,750 - 125,400 = 350	ext{ km}$.
* Mức tiêu hao = $(50 / 350) 	imes 100 = mathbf{14.28	ext{ L/100km}}$.
* So sánh với **Định mức chuẩn 15.0 L/100km** đã cài đặt của xe:
  * Nếu $le 15.0$ L/100km ➜ **Huy hiệu Xanh (Bình thường)**.
  * Nếu $> 15.0$ L/100km ➜ **Huy hiệu Đỏ (Bất thường / Cảnh báo hao hụt / Nghi vấn rút trộm)** để Chủ trại và Kế toán kiểm tra.

---

## 4. NHẬP BỒN DẦU TỔNG TỪ XE BỒN PETROLIMEX
1. Truy cập menu **Kho xăng dầu** (`/fuel`) ➜ Tab **"Nhập bồn dầu"** ➜ Bấm **"Nhập bồn mới"**.
2. Chọn loại nhiên liệu (Dầu DO 0.05S), nhập **Số lít nhập** (ví dụ: `5,000` lít), **Đơn giá mua**, **Nhà cung cấp** và **Số hóa đơn VAT**.
3. Bấm **"Xác nhận nhập bồn"** ➜ Tồn kho bồn dầu tăng lên ngay lập tức và lưu sổ cái.

---

## 5. QUẢN LÝ HỒ SƠ GIẤY TỜ XE CƠ GIỚI (`/admin/vehicles`)
* **Đường dẫn:** Menu **Quản trị** ➜ **Xe cơ giới** (`/admin/vehicles`).
* **Quản lý hồ sơ & hạn đăng kiểm:**
  1. Tải lên ảnh chụp thực tế: **Giấy đăng kiểm**, **Bảo hiểm xe**, **Cà vẹt xe**, **Ảnh xe thực tế** (`document_images`).
  2. Nhập **Hạn đăng kiểm tiếp theo** (`inspection_expiry`) ➜ Hệ thống tự động cảnh báo xe sắp hết hạn đăng kiểm trên Dashboard.
  3. In tem decal QR vector dán kính lái và nắp bình dầu xe.
