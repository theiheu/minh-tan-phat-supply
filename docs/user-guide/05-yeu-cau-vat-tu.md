# 📖 HƯỚNG DẪN 05: YÊU CẦU VẬT TƯ CHUỒNG TRẠI (DUYỆT 2 CẤP)

Quy trình công nhân/trưởng chuồng lập phiếu xin cấp vật tư, Kỹ thuật duyệt cấp 1, Quản kho xuất hàng và hoàn trả vật tư dùng thừa.

---

## 1. SƠ ĐỒ QUY TRÌNH DUYỆT 2 CẤP

```
  [1. Công nhân / Trưởng chuồng]  ─── (Lập phiếu xin cấp vật tư trên điện thoại)
                 │
                 ▼
  [2. Kỹ thuật / Quản lý khu]    ─── (Xem xét & Duyệt cấp 1: Chấp thuận / Từ chối)
                 │
                 ▼
  [3. Quản kho tổng]             ─── (Xuất kho & Giao hàng: Trừ tồn kho hệ thống)
                 │
                 ▼
  [4. Nhận đồ & Trả hàng thừa]   ─── (Công nhân nhận đồ; nếu thừa bấm Trả lại kho)
```

---

## 2. CÁC BƯỚC THỰC HIỆN CHI TIẾT

### Bước 1: Lập phiếu xin cấp (Công nhân / Người yêu cầu)
* Vào menu **Yêu cầu** (`/requisitions`) ➜ Bấm **"Tạo phiếu yêu cầu"** (`/requisitions/new`).
* Chọn **Khu vực & Trại chăn nuôi** cần cấp (Ví dụ: *Khu B - Trại B3*).
* Chọn danh sách vật tư cần xin (Bóng đèn, lưới, vỉ trứng, thuốc...).
* Nhập **Mức độ ưu tiên:** *Bình thường* hoặc *Khẩn cấp*.
* Bấm **"Gửi yêu cầu"**.

### Bước 2: Duyệt cấp 1 (Kỹ thuật / Quản lý cơ sở)
* Trưởng khu / Kỹ sư cơ sở vào mục **Yêu cầu**, lọc các phiếu ở trạng thái *Chờ duyệt*.
* Kiểm tra định mức sử dụng của chuồng ➜ Bấm **"Duyệt yêu cầu"** hoặc **"Từ chối"** kèm lý do.

### Bước 3: Xuất kho giao hàng (Quản kho)
* Quản kho nhận phiếu đã được Kỹ thuật duyệt ➜ Chuẩn bị hàng ➜ Bấm **"Xuất kho giao hàng"**.
* Tồn kho trừ ngay lập tức và in phiếu giao nhận.

### Bước 4: Trả lại vật tư thừa (Nếu có)
* Nếu chuồng xin 10 bóng đèn nhưng chỉ dùng hết 8 bóng, công nhân mang 2 bóng thừa trả lại kho.
* Quản kho mở lại phiếu yêu cầu ➜ Bấm **"Trả lại vật tư thừa"** ➜ Kho tự động cộng lại 2 bóng vào tồn kho.
