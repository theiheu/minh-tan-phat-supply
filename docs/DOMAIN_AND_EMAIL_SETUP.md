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

## 5. Ma Trận Phân Luồng Email Theo Vai Trò (Role-Tailored Notification Matrix)

Hệ thống MTP-ERP phân định nghiêm ngặt luồng thông báo email theo đúng 7 vai trò chuẩn và đối tượng liên quan (Participants):

| Vai trò | Phân luồng thông báo Email được nhận | Loại mẫu Email | Ranh giới dữ liệu tài chính |
|---|---|---|---|
| **`owner`** (Chủ trại / Giám đốc) | Nghiệp vụ tài chính và chênh lệch quan trọng: Nhập kho, Xuất bán, Duyệt/Hoàn tất thanh lý, Chốt kiểm kê có lệch, Chi phí sửa chữa hoàn tất | `finance`, `result` | **Hiển thị đầy đủ** giá trị & thành tiền VNĐ |
| **`accountant`** (Kế toán) | Chứng từ tài chính đã phát sinh: Nhập kho hoàn tất, Xuất bán hoàn tất, Hoàn tất thanh lý, Kiểm kê có chênh lệch | `finance` | **Hiển thị đầy đủ** giá trị & thành tiền VNĐ |
| **`warehouse`** (Thủ kho) | Hành động kho cần xử lý & kết quả điều hành: YCCP đã duyệt cần xuất kho, Báo hỏng mới cần xử lý, Mượn CCDC, CCDC quá hạn, Tiếp nhận sửa chữa về kho | `action`, `result` | **Ẩn tuyệt đối** giá trị tiền |
| **`technician`** (Kỹ thuật viên) | Lệnh sửa chữa gửi nhà cung cấp, nghiệm thu thiết bị sửa chữa xong đưa về kho | `action`, `result` | **Ẩn** dữ liệu giá vốn tài chính |
| **`requester`** (Người yêu cầu / Trưởng khu) | Trực tiếp chứng từ của bản thân: YCCP duyệt / từ chối / đã cấp phát, Nhắc hẹn trả CCDC (trước 24h & khi bắt đầu quá hạn) | `result`, `action` | **Ẩn tuyệt đối** giá trị tiền |
| **`driver`** (Tài xế / Người lái xe) | Phiếu cấp phát nhiên liệu trực tiếp theo tài khoản lái xe, hủy/điều chỉnh cấp dầu | `driver` | Chỉ hiển thị số lít, chỉ số Odo, biển số xe |
| **`superuser`** (Quản trị viên kỹ thuật) | Thông báo sự cố hệ thống, bảo mật, thông báo broadcast nội bộ | `result` | **Không nhận** email nghiệp vụ kho hàng ngày |

---

## 6. Lịch Tự Động Nhắc Trả Công Cụ Dụng Cụ (Tool Reminders Cron)

Hệ thống tích hợp Endpoint Scheduler nội bộ để tự động quét và gửi email nhắc trả CCDC:
- **Tần suất quét:** Chạy định kỳ mỗi giờ hoặc mỗi ngày một lần (ví dụ lúc 08:00 sáng).
- **Lịch gửi nhắc:**
  1. Nhắc sắp đến hạn: Đúng **24 giờ trước thời điểm hẹn trả** (`tool.due_soon`).
  2. Nhắc quá hạn: **Một lần duy nhất ngay khi bắt đầu quá hạn** (`tool.overdue_started`).
- **Endpoint:** `POST /api/internal/tool-reminders`
- **Xác thực an toàn:** Header `Authorization: Bearer <CRON_SECRET hoặc INTERNAL_API_SECRET>`
- **Cơ chế chống gửi trùng (Idempotency):** Khóa giao dịch phân tán qua RPC `claim_tool_reminders` và sổ cái `tool_reminder_claims` + `email_delivery_attempts`.

**Ví dụ thiết lập Cron Job trên máy chủ Linux:**
```bash
# Chạy mỗi giờ quét nhắc hạn CCDC
0 * * * * curl -X POST https://kho.yourdomain.com/api/internal/tool-reminders -H "Authorization: Bearer YOUR_CRON_SECRET"
```
