# 🔧 SỔ TAY XỬ LÝ SỰ CỐ & KHẮC PHỤC LỖI (TROUBLESHOOTING GUIDE)

> Cẩm nang chẩn đoán nguyên nhân và quy trình xử lý chuẩn xác cho Kỹ sư Vận hành, Kế toán và Quản trị viên khi phát sinh sự cố kỹ thuật trong hệ thống **Minh Tân Phát Supply**.

---

## 1. LỖI KHÔNG THỂ XÓA TÀI KHOẢN ("DATABASE ERROR DELETING USER")

### Hiện tượng:
Quản lý bấm nút xóa tài khoản của một nhân viên nhưng hệ thống báo lỗi vi phạm khóa ngoại.

### Nguyên nhân:
Nhân viên này đã từng tham gia ký duyệt chứng từ (Phiếu nhập kho, Phiếu xuất kho, Phiếu yêu cầu, Đổi 1-1). Khóa ngoại PostgreSQL bảo vệ tính toàn vẹn của sổ cái kế toán, không cho phép xóa bản ghi cha khi bản ghi con đang tham chiếu.

### Hướng xử lý chuẩn:
1. **Chuyển sang Lưu trữ / Khóa tài khoản:**
   * Không xóa cứng tài khoản.
   * Bấm nút **Khóa / Lưu trữ** để đưa nhân viên sang tab **"Đã nghỉ việc / Lưu trữ"** (`is_active = false`).
   * Quyền đăng nhập bị khóa ngay lập tức, chứng từ lịch sử được bảo toàn 100%.
2. **Nếu là tài khoản test cần xóa sạch:**
   * Đăng nhập bằng tài khoản `superuser`.
   * Trong modal xóa, chọn tùy chọn **"Xóa sạch toàn bộ (Bao gồm phiếu)"** để thực thi RPC `admin_purge_user_data`.

---

## 2. HIỆN THỊ BANNER NGOẠI TUYẾN ("ĐANG Ở CHẾ ĐỘ NGOẠI TUYẾN")

### Hiện tượng:
Màn hình điện thoại công nhân xuất hiện thanh thông báo màu vàng: *Đang ở chế độ ngoại tuyến (Offline)*.

### Nguyên nhân:
Vị trí chuồng nuôi hoặc kho nằm ngoài vùng phủ sóng Wi-Fi hoặc mất kết nối 4G.

### Hướng xử lý:
* **Không cần tải lại trang:** Ứng dụng PWA (Service Worker) vẫn cho phép tra cứu danh mục hàng hóa và lập phiếu yêu cầu bình thường.
* Dữ liệu được lưu trữ tạm thời trong IndexedDB trên điện thoại.
* Khi di chuyển về khu vực có sóng mạng, hệ thống sẽ tự động đồng bộ lên máy chủ.

---

## 3. XUNG ĐỘT CỔNG 3000 HOẶC 3001 (PORT ALREADY IN USE)

### Hiện tượng:
Khi chạy `pnpm dev` hoặc khởi động service báo lỗi `EADDRINUSE: address already in use 0.0.0.0:3000`.

### Cách khắc phục:
```bash
# 1. Tìm tiến trình đang chiếm dụng cổng 3000 hoặc 3001
sudo lsof -i :3000
sudo lsof -i :3001

# 2. Giải phóng cổng bị treo
sudo fuser -k 3000/tcp
sudo fuser -k 3001/tcp

# 3. Khởi động lại dịch vụ web
sudo systemctl restart mtp-web
```

---

## 4. LỖI FONT TIẾNG VIỆT KHI IN PHIẾU PDF (VỠ FONT / MẤT DẤU)

### Hiện tượng:
Phiếu xuất kho hoặc phiếu nhập kho in ra bị lỗi ô vuông hoặc dấu hỏi (?) ở các ký tự tiếng Việt có dấu.

### Nguyên nhân:
Trình duyệt hoặc server thiếu bộ font vector tiếng Việt `Be Vietnam Pro`.

### Cách khắc phục:
```bash
# 1. Kiểm tra file font trong thư mục public/fonts
ls -la public/fonts/

# 2. Chạy script kiểm thử render font tiếng Việt tự động
npx tsx scripts/verify-pdf-font.tsx
```

---

## 5. LỖI GỬI EMAIL THÔNG BÁO DOANH NGHIỆP (SMTP ERROR)

### Hiện tượng:
Hệ thống không gửi được email thông báo đơn duyệt cho quản lý, console báo `Error: Invalid login: 535 Authentication failed`.

### Cách kiểm tra & Khắc phục:
1. Kiểm tra lại thông tin SMTP trong file `.env.production`:
   * Nếu dùng Gmail: Bắt buộc dùng **Mật khẩu ứng dụng 16 ký tự (App Password)**, không dùng mật khẩu email cá nhân thông thường.
   * Nếu dùng SMTP hosting doanh nghiệp: Kiểm tra `SMTP_PORT=587` (với `SMTP_SECURE=false`) hoặc `SMTP_PORT=465` (với `SMTP_SECURE=true`).
2. Chạy script gán và kiểm tra email:
```bash
pnpm assign:emails
```

---

## 6. LỖI UPLOAD ẢNH HÓA ĐƠN HOẶC ẢNH HƯ HỎNG (STORAGE ERROR)

### Hiện tượng:
Tải ảnh hóa đơn VAT hoặc ảnh motor cháy báo lỗi `StorageApiError: Bucket not found` hoặc `403 Unauthorized`.

### Cách khắc phục:
1. Đảm bảo Storage Bucket `invoices`, `defects`, `receipts` đã được khởi tạo trong Supabase.
2. Kiểm tra lại RLS Policy trên bảng `storage.objects` cho phép tài khoản đã đăng nhập upload file.
3. Chạy script kiểm tra phân quyền ảnh:
```bash
npx tsx scripts/verify-image-permissions.ts
```
