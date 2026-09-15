# 📖 HƯỚNG DẪN 09: TRẠM BỒN DẦU NỘI BỘ & QUẢN LÝ XE MÁY (QUÉT QR 5 GIÂY)

Quy trình cấp phát dầu Diesel cho xe ben xúc phân, xe xúc lật, xe bồn cám, máy phát điện và tự động tính định mức tiêu hao (Lít/100km hoặc Lít/Giờ máy) nhằm chống rút trộm nhiên liệu.

---

## 1. QUY TRÌNH ĐỔ DẦU BẰNG MÃ QR (Quản kho dầu / Tài xế)

```
  [1. Xe đến trạm bồn] ──► [2. Quét mã QR trên cabin xe] ──► [3. Nhập số Lít & số ODO hiện tại] ──► [4. Hệ thống tự động tính Lít/100km]
```

1. **Bước 1:** Quản kho dầu cầm điện thoại / máy tính bảng mở mục **Quét mã QR Dầu** (`/fuel/scan`).
2. **Bước 2:** Hướng camera vào **Tem QR dán trên nắp bình dầu hoặc cabin xe**.
3. **Bước 3:** Màn hình tự động nhận diện:
   * Tên xe: `Xe ben Howo 4 chân - 61C-123.45`
   * Tài xế: `Mạnh Đức`
   * Số ODO lần đổ trước: `125,400 km`.
4. **Bước 4:** Bơm dầu vào xe và nhập:
   * **Số lít thực bơm:** Ví dụ `50` lít.
   * **Số ODO hiện tại trên đồng hồ xe:** Ví dụ `125,750` km.
5. **Bước 5:** Bấm **"Xác nhận cấp dầu"**.

---

## 2. KẾT QUẢ TÍNH ĐỊNH MỨC & CẢNH BÁO TỰ ĐỘNG
* Kho dầu trừ ngay 50 lít.
* Hệ thống tính: Chạy 350 km hết 50 lít = **14.28 Lít / 100km**.
* So sánh với **Định mức chuẩn 15.0 Lít/100km**:
  * Nếu $le 15.0$ L/100km ➜ **Huy hiệu Xanh (Bình thường)**.
  * Nếu $> 15.0$ L/100km ➜ **Huy hiệu Đỏ (Bất thường / Cảnh báo hao hụt / Nghi vấn rút trộm)** để Chủ trại và Kế toán kiểm tra.
