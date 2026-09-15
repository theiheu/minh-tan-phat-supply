# 🔧 XỬ LÝ SỰ CỐ & KHẮC PHỤC LỖI (TROUBLESHOOTING)

Tổng hợp các lỗi kỹ thuật thường gặp và quy trình xử lý chuẩn xác cho kỹ sư vận hành.

---

## 1. LỖI KHÔNG THỂ XÓA TÀI KHOẢN NGƯỜI DÙNG ("Database error deleting user")
* **Nguyên nhân:** Nhân viên này đã từng ký duyệt hoặc tạo phiếu nhập, xuất kho, báo hỏng trong quá khứ. Khóa ngoại PostgreSQL bảo vệ tính toàn vẹn sổ cái kế toán.
* **Giải pháp chuẩn:**
  * Không xóa vĩnh viễn. Chuyển sang **Khóa tài khoản / Đánh dấu nghỉ việc (Archive)**.
  * Nếu là Quản trị hệ thống (`superuser`) muốn xóa sạch triệt để môi trường test: Chọn nút **"Xóa sạch toàn bộ (Bao gồm phiếu)"** trong modal xác nhận.

---

## 2. LỖI MẤT KẾT NỐI MẠNG NGOẠI TUYẾN TẠI KHU CHUỒNG
* **Hiện tượng:** Màn hình xuất hiện thanh thông báo màu vàng: *Đang ở chế độ ngoại tuyến (Offline)*.
* **Xử lý:**
  * Ứng dụng PWA vẫn hoạt động bình thường, cho phép quét QR và tạo phiếu yêu cầu.
  * Dữ liệu được lưu trữ tạm thời trong IndexedDB trên điện thoại.
  * Khi di chuyển ra khu vực có sóng Wi-Fi/4G, hệ thống sẽ tự động đồng bộ lên máy chủ.

---

## 3. QUÊN MẬT KHẨU TÀI KHOẢN QUẢN TRỊ VIÊN
* Kỹ sư CNTT có thể truy cập máy chủ và đặt lại mật khẩu trực tiếp qua Supabase Auth Admin API hoặc file seed:
```bash
pnpm tsx scripts/seed-complete-data.ts
```
