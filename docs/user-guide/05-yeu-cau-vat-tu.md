# 📖 HƯỚNG DẪN 05: YÊU CẦU VẬT TƯ TRANG TRẠI (TIẾN TRÌNH 5 BƯỚC & HÓA ĐƠN)

Quy trình công nhân/trưởng trại lập phiếu xin cấp vật tư trên điện thoại, theo dõi tiến trình 5 cột mốc, tải ảnh hóa đơn mua gấp và hoàn trả vật tư thừa.

---

## 1. SƠ ĐỒ TIẾN TRÌNH 5 CỘT MỐC (5-STAGE MILESTONE PROGRESS)

```
  [1. Gửi yêu cầu] ──► [2. Kỹ thuật duyệt] ──► [3. Đang đặt hàng] ──► [4. Kho xuất cấp] ──► [5. Hoàn tất nhận hàng]
     (Requester)           (Technician)           (Warehouse/NCC)         (Warehouse)             (Requester)
```

---

## 2. CÁC BƯỚC THỰC HIỆN CHI TIẾT

### Bước 1: Lập phiếu xin cấp (Công nhân / Người yêu cầu)
* Vào menu **Yêu cầu** (`/requisitions`) ➜ Bấm **"Tạo phiếu yêu cầu"** (`/requisitions/new`).
* Chọn **Khu vực & Dãy trại** cần cấp (Ví dụ: *Khu B - Trại B3*).
* **Chọn đơn vị tính linh hoạt:** Đối với vật tư đóng gói đa cấp (VD: Keo dán bạt, thuốc sát trùng), bạn có thể tùy ý chọn xin theo **Thùng** (khi làm diện rộng) hoặc theo **Hộp** (khi làm lẻ). Hệ thống sẽ tự động hiển thị số lượng quy đổi tương đương Base UOM. *(Xem [Hướng dẫn 13: Quy đổi đơn vị](./13-quy-doi-don-vi-dong-goi.md))*.
* Nhập **Mức độ ưu tiên:** *Bình thường* hoặc *Khẩn cấp*.
* Bấm **"Gửi yêu cầu"** ➜ Phiếu chuyển sang cột mốc **Chờ duyệt (`pending`)**.

### Bước 2: Duyệt cấp 1 (Kỹ thuật trưởng / Quản lý cơ sở)
* Trưởng khu / Kỹ sư cơ sở vào mục **Yêu cầu**, xem xét các phiếu đang chờ duyệt.
* Kiểm tra định mức sử dụng của trại ➜ Bấm **"Duyệt yêu cầu"** (`approved`) hoặc **"Từ chối"** kèm lý do.

### Bước 3: Đánh dấu đặt hàng NCC (Nếu kho hết hàng)
* Nếu vật tư trong kho không đủ sẵn, Quản kho hoặc Kế toán bấm **"Đang đặt hàng"** (`ordered`) để báo cho người yêu cầu biết vật tư đã được đặt từ Nhà cung cấp ngoài.
* **Tải ảnh hóa đơn / Chứng từ mua gấp:** Người yêu cầu hoặc Quản kho có thể chụp ảnh hóa đơn mua lẻ hoặc phiếu xuất của NCC đính kèm trực tiếp vào phiếu (`invoice_images`).

### Bước 4: Xuất kho giao hàng & Tự động cấp phát (Auto-Fulfill)
* **Xuất thủ công:** Khi hàng đã sẵn trong kho, Quản kho bấm **"Xuất kho giao hàng"** (`fulfill_requisition`) ➜ Tồn kho vật lý bị trừ ngay lập tức và phiếu chuyển sang trạng thái **Đã xuất (`issued`)**.
* **Auto-Fulfill tự động:** Khi Quản kho nhập hàng mới từ NCC (`post_receipt`), hệ thống tự động tìm các phiếu đã duyệt (`approved` / `ordered`) theo thứ tự FIFO, tự động xuất hàng và đồng bộ ảnh hóa đơn 2 chiều.

### Bước 5: Xác nhận đã nhận đủ & Hoàn trả vật tư thừa
* **Xác nhận 2 chiều:** Công nhân nhận được vật tư tại trại mở app và bấm **"Xác nhận đã nhận"** (`received`) để đóng phiếu hoàn tất.
* **Trả lại vật tư thừa:** Nếu xin 10 bóng đèn nhưng chỉ dùng hết 8 bóng, công nhân mang 2 bóng thừa trả lại kho. Quản kho mở lại phiếu ➜ Bấm **"Trả lại vật tư thừa"** ➜ Hệ thống tự động cộng lại 2 bóng vào tồn kho.
