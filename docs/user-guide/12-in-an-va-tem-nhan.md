# 📖 HƯỚNG DẪN 12: IN PHIẾU CHUẨN A4/A5 & IN TEM NHÃN MÃ QR

Hướng dẫn in ấn chứng từ kho chuẩn mực theo nhận diện thương hiệu Trang trại Lê Văn Dương và in tem nhãn QR dán kệ hàng, dán thiết bị và xe cơ giới.

---

## 1. CÔNG NGHỆ IN ẤN VECTOR & FONT TIẾNG VIỆT

* **Engine in ấn:** Nhúng thư viện `@react-pdf/renderer` trực tiếp trong ứng dụng, render ra file PDF chuẩn vector không bị vỡ chữ hay nhòe hình.
* **Bộ font nhúng sẵn:** Font UTF-8 chuẩn `Roboto-Regular` và `Roboto-Bold` hiển thị 100% dấu tiếng Việt chuẩn xác.
* **Nhận diện thương hiệu chuẩn mực:** Header có logo Trang trại Gà Đẻ Trứng Lê Văn Dương, địa chỉ Minh Tân - Dầu Tiếng - Bình Dương, số điện thoại hotline và đầy đủ 4 ô chữ ký trách nhiệm (Người lập, Thủ kho, Người nhận hàng, Kế toán).
* **Mã QR tra cứu điện tử:** Ở góc trên bên phải của mọi phiếu in đều có mã QR chứa link tra cứu trực tiếp thông tin và trạng thái lịch sử của phiếu trên phần mềm.

---

## 2. DANH MỤC CÁC MẪU PHIẾU IN HỖ TRỢ (A4 / A5)

| Mẫu phiếu in | Mã chứng từ | Khổ giấy | Đối tượng ký duyệt |
|---|---|:---:|---|
| **Phiếu Nhập Kho** | `NK-YYYYMM-XXX` | A4 / A5 | Người giao hàng (NCC), Thủ kho, Kế toán |
| **Phiếu Xuất Kho / Cấp Phát** | `XK-YYYYMM-XXX` | A4 / A5 | Người nhận hàng (Trưởng chuồng), Thủ kho, Kế toán |
| **Phiếu Yêu Cầu Vật Tư** | `REQ-YYYYMM-XXX` | A4 / A5 | Người lập phiếu, Kỹ thuật trưởng duyệt, Thủ kho |
| **Phiếu Đổi 1-1 Cấp Tốc** | `EX-YYYYMM-XXX` | A5 | Thợ cơ điện đổi, Thủ kho xác nhận |
| **Phiếu Sửa Chữa Cơ Điện** | `SC-YYYYMM-XXX` | A4 / A5 | Đại diện xưởng quấn motor, Kỹ thuật trưởng |
| **Phiếu Thanh Lý Phế Liệu** | `TL-YYYYMM-XXX` | A4 / A5 | Người mua ve chai, Chủ trại duyệt |
| **Phiếu Mượn Dụng Cụ** | `TB-YYYYMM-XXX` | A5 | Thợ mượn đồ nghề, Quản kho |
| **Phiếu Cấp Dầu Xe Cơ Giới** | `FD-YYYYMM-XXX` | A5 | Tài xế lái xe, Quản kho dầu |
| **Phiếu Nhập Bồn Dầu Tổng** | `FR-YYYYMM-XXX` | A4 / A5 | Lái xe bồn Petrolimex, Quản kho dầu, Kế toán |
| **Biên Bản Kiểm Kê Kho** | `ST-YYYYMM-XXX` | A4 | Ban kiểm kê, Thủ kho, Chủ trại duyệt |

---

## 3. IN TEM DECAL QR DÁN VẬT TƯ, KỆ HÀNG & XE CƠ GIỚI

### A. Tem QR Vật tư / Kệ hàng:
1. Vào chi tiết SKU vật tư trong **Quản trị Vật tư** (`/admin/products`).
2. Bấm nút **"In tem QR"**.
3. Tem in hiển thị: Tên SKU, Mã SKU, Đơn vị tính, Vị trí kệ và Mã QR chứa link tra cứu.

### B. Tem QR Decal Dán Xe Cơ Giới:
1. Vào mục **Quản trị Xe cơ giới** (`/admin/vehicles`).
2. Bấm nút **"In mã QR xe"**.
3. Tem in hiển thị: Tên xe, Biển số, Loại dầu sử dụng, Định mức chuẩn và Mã QR vector.
4. Dán tem trực tiếp lên kính lái cabin xe hoặc nắp bình dầu để quét bằng điện thoại khi bơm dầu.
