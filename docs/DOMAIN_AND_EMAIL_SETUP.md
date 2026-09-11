# Hướng dẫn cấu hình Tên miền & Email Doanh nghiệp

Tài liệu hướng dẫn chi tiết cách cấu hình **Tên miền (Domain)** và **Email Doanh nghiệp (Corporate SMTP)** cho hệ thống Minh Tân Phát Supply.

---

## 1. Cấu hình Tên miền (Domain Setup)

### Bước 1: Trỏ DNS tên miền về máy chủ
Truy cập trang quản lý DNS của nhà cung cấp tên miền (Cloudflare, PA Vietnam, Mat Bao, Namecheap, GoDaddy...) và cấu hình các bản ghi:

| Loại | Tên (Host) | Giá trị (Value) | Ghi chú |
|---|---|---|---|
| **A** | `kho` (hoặc `@` / `supply`) | `<IP_MÁY_CHỦ_VPS>` | Địa chỉ web ứng dụng |
| **A** | `api.kho` (nếu dùng subdomain cho DB) | `<IP_MÁY_CHỦ_VPS>` | Địa chỉ Supabase API |

### Bước 2: Cấu hình biến môi trường trong file `.env.production` (hoặc `.env.local`)
```env
NEXT_PUBLIC_SITE_URL=https://kho.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://api.kho.yourdomain.com
```

### Bước 3: Cấu hình Reverse Proxy (Caddy / Nginx) tự động cấp SSL HTTPS
**Nếu dùng Caddy (khuyến nghị - tự động cấp chứng chỉ Let's Encrypt SSL miễn phí):**
Tạo hoặc sửa file `Caddyfile`:
```caddy
kho.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}

api.kho.yourdomain.com {
    reverse_proxy 127.0.0.1:8000
}
```

---

## 2. Cấu hình Email Doanh nghiệp (Business Email SMTP)

Hệ thống hỗ trợ gửi email thông báo qua giao thức SMTP tiêu chuẩn, tương thích 100% với tất cả các dịch vụ email doanh nghiệp.

### A. Google Workspace (Gmail Doanh nghiệp)
1. Bật xác thực 2 bước (2FA) trên tài khoản Google quản trị / hòm thư gửi.
2. Vào **Bảo mật** &rarr; **Mật khẩu ứng dụng (App Passwords)** &rarr; Tạo mật khẩu mới (16 ký tự).
3. Cấu hình trong `.env.production`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notification@yourdomain.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM="Minh Tân Phát - Kho & Cấp Phát" <notification@yourdomain.com>
```

### B. Microsoft 365 / Outlook Doanh nghiệp
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notification@yourdomain.com
SMTP_PASS=your_m365_password
SMTP_FROM="Minh Tân Phát Supply" <notification@yourdomain.com>
```

### C. Zoho Mail Doanh nghiệp
```env
SMTP_HOST=smtppro.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=notification@yourdomain.com
SMTP_PASS=your_zoho_app_password
SMTP_FROM="Minh Tân Phát - Kho Vật Tư" <notification@yourdomain.com>
```

### D. Máy chủ SMTP Riêng / cPanel / DirectAdmin / VPS Mail Server
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@yourdomain.com
SMTP_PASS=your_email_password
SMTP_FROM="Minh Tân Phát" <no-reply@yourdomain.com>
```

---

## 3. Cấu hình DNS để Email không bị vào mục Spam (SPF / DKIM / DMARC)

Để email gửi từ hệ thống luôn vào hộp thư đến (**Inbox**) của nhân viên và đối tác:

1. **Bản ghi SPF (TXT)** trên tên miền:
   - Google Workspace: `v=spf1 include:_spf.google.com ~all`
   - Zoho Mail: `v=spf1 include:zoho.com ~all`
   - Microsoft 365: `v=spf1 include:spf.protection.outlook.com ~all`
   - SMTP theo IP máy chủ: `v=spf1 ip4:<IP_MÁY_CHỦ> ~all`

2. **Bản ghi DKIM (TXT / CNAME)**: Lấy khóa DKIM từ bảng điều khiển email doanh nghiệp và thêm vào DNS.

3. **Bản ghi DMARC (TXT)**:
   - Host: `_dmarc.yourdomain.com`
   - Value: `v=DMARC1; p=none; rua=mailto:admin@yourdomain.com`

---

## 4. Gán Email cho Người Dùng & Thử nghiệm Gửi Email

### Cách 1: Thao tác trực tiếp trên Giao diện Web
1. Đăng nhập tài khoản Quản lý kho / Superuser.
2. Vào **Quản trị** &rarr; **Người dùng** (`/admin/users`).
3. Tại khối **"Công cụ Email Doanh Nghiệp & Thông báo"**:
   - **Thử nghiệm kết nối SMTP:** Nhập email của bạn và nhấn *"Gửi email kiểm tra"*.
   - **Gán email theo tên miền:** Nhập tên miền (ví dụ `minhtanphat.vn`) và nhấn *"Gán email tự động"* để tự động đặt email dạng `username@minhtanphat.vn` cho toàn bộ nhân viên.
   - **Phát thông báo hệ thống:** Gửi thông báo chuông và email đồng loạt cho toàn bộ nhân viên.
4. Tại bảng danh sách bên dưới, bạn cũng có thể chỉnh sửa thủ công email của từng người dùng cụ thể.

### Cách 2: Chạy lệnh CLI từ Terminal máy chủ
```bash
# Gán email tự động cho toàn bộ tài khoản chưa có email
pnpm run assign:emails yourdomain.com

# Ghi đè lại toàn bộ email theo tên miền mới
pnpm run assign:emails yourdomain.com --overwrite
```

---

## 5. Danh sách các Thông báo Email Tự Động

| Nghiệp vụ | Sự kiện kích hoạt | Người nhận email |
|---|---|---|
| **Yêu cầu vật tư (Requisition)** | Gửi duyệt phiếu | Toàn bộ Quản lý kho & Superuser |
| | Duyệt phiếu | Người yêu cầu |
| | Cấp phát vật tư xong | Người yêu cầu (để xác nhận đã nhận) |
| | Xác nhận nhận hàng | Quản lý kho |
| | Từ chối phiếu (kèm lý do) | Người yêu cầu |
| | Hủy phiếu | Người yêu cầu / Quản lý kho |
| **Đổi mới vật tư hỏng (Exchange)** | Tạo phiếu đổi mới | Quản lý kho / Người báo hỏng |
| | Duyệt đổi mới / Xuất kho | Người báo hỏng |
| **Báo hỏng vật tư (Defect)** | Nhân viên tạo phiếu báo hỏng | Toàn bộ Quản lý kho |
| **Mượn dụng cụ (Tool Borrowing)** | Lập phiếu xuất mượn dụng cụ | Người mượn dụng cụ |
| **Thông báo hệ thống (Broadcast)** | Quản trị viên gửi thông báo chung | Toàn bộ người dùng đang hoạt động |
