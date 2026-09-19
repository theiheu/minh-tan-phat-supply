# 📖 HƯỚNG DẪN 09: TRẠM BỒN DẦU NỘI BỘ & QUẢN LÝ XE CƠ GIỚI (QUÉT QR 5 GIÂY)

Quy trình quản lý nhập bồn dầu Petrolimex, cấp phát dầu Diesel cho xe ben xúc phân, xe xúc lật, xe bồn cám, máy phát điện; tự động tính định mức tiêu hao (Lít/100km hoặc Lít/Giờ máy) nhằm chống rút trộm nhiên liệu và quản lý giấy tờ xe.

---

## 1. QUY TRÌNH ĐỔ DẦU BẰNG MÃ QR (Quản kho dầu / Tài xế)

```
  [1. Xe đến trạm bồn] ──► [2. Quét mã QR trên cabin xe] ──► [3. Nhập số Lít & số ODO hiện tại] ──► [4. Hệ thống tự động tính Lít/100km hoặc Lít/h]
```

1. **Bước 1:** Quản kho dầu hoặc Tài xế mở mục **Quét mã QR Dầu** (`/fuel/scan`) trên điện thoại.
2. **Bước 2:** Hướng camera vào **Tem QR dán trên nắp bình dầu hoặc kính lái cabin xe**.
3. **Bước 3:** Màn hình tự động nhận diện ngay trong 1 giây:
   * Tên xe & Biển số: `Xe ben Howo 4 chân - 61C-123.45`
   * Tài xế phụ trách: `Mạnh Đức`
   * Loại nhiên liệu: `Dầu DO 0.05S`
   * Số ODO / Giờ máy lần đổ trước: `125,400 km`.
4. **Bước 4:** Bơm dầu vào xe và nhập:
   * **Số lít thực bơm:** Ví dụ `50` lít.
   * **Số ODO hiện tại trên đồng hồ xe:** Ví dụ `125,750` km.
5. **Bước 5:** Bấm **"Xác nhận cấp dầu"**.

---

## 2. KẾT QUẢ TÍNH ĐỊNH MỨC & CẢNH BÁO TỰ ĐỘNG
* Bồn dầu tổng trừ ngay 50 lít vào sổ cái `fuel_movements`.
* Hệ thống tính: Quãng đường chạy = $125,750 - 125,400 = 350\text{ km}$.
* Mức tiêu hao = $(50 / 350) \times 100 = \mathbf{14.28\text{ L/100km}}$.
* So sánh với **Định mức chuẩn 15.0 L/100km** đã cài đặt của xe:
  * Nếu $\le 15.0$ L/100km ➜ **Huy hiệu Xanh (Bình thường)**.
  * Nếu $> 15.0$ L/100km ➜ **Huy hiệu Đỏ (Bất thường / Cảnh báo hao hụt / Nghi vấn rút trộm)** để Chủ trại và Kế toán kiểm tra.

---

## 3. NHẬP BỒN DẦU TỔNG TỪ XE BỒN PETROLIMEX
1. Truy cập menu **Kho xăng dầu** (`/fuel`) ➜ Tab **"Nhập bồn dầu"** ➜ Bấm **"Nhập bồn mới"**.
2. Chọn loại nhiên liệu (Dầu DO 0.05S), nhập **Số lít nhập** (ví dụ: `5,000` lít), **Đơn giá mua**, **Nhà cung cấp** và **Số hóa đơn VAT**.
3. Bấm **"Xác nhận nhập bồn"** ➜ Tồn kho bồn dầu tăng lên ngay lập tức.

---

## 4. QUẢN LÝ HỒ SƠ GIẤY TỜ XE CƠ GIỚI (`/admin/vehicles`)
* **Đường dẫn:** Menu **Quản trị** ➜ **Xe cơ giới** (`/admin/vehicles`).
* **Tải ảnh giấy tờ xe:** Bấm vào nút icon **Giấy tờ xe** trên dòng của từng xe:
  1. Tải lên ảnh chụp thực tế: **Giấy đăng kiểm**, **Bảo hiểm xe**, **Cà vẹt xe**, **Ảnh xe thực tế**.
  2. Xem lại ảnh phóng to sắc nét bất cứ lúc nào qua modal trực tiếp trên app.
  3. In tem QR dán kính lái và nắp bình dầu.
