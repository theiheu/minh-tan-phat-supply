# ⚙️ HƯỚNG DẪN TRIỂN KHAI & CẤU HÌNH HỆ THỐNG (DEPLOYMENT RUNBOOK)

Tài liệu kỹ thuật hướng dẫn triển khai, thiết lập môi trường và cấu hình máy chủ cho hệ thống **Minh Tân Phát Supply**.

---

## 1. YÊU CẦU MÔI TRƯỜNG MÁY CHỦ (SYSTEM PREREQUISITES)
* **Hệ điều hành:** Ubuntu 22.04 LTS / Debian 12 / Docker Host.
* **Node.js:** Phiên bản 20.x hoặc 24.x LTS.
* **Package Manager:** `pnpm` (khuyên dùng `pnpm@10+`).
* **Docker & Docker Compose:** Để chạy cụm Supabase local / self-hosted container.

---

## 2. BIẾN MÔI TRƯỜNG (`.env.local`)

Tạo file `.env.local` tại thư mục gốc với các thông số:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1Ni...
NEXT_PUBLIC_SITE_URL=http://localhost:3080

# SMTP Enterprise Email Configuration
SMTP_HOST=mail.minhtanphat.io.vn
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@minhtanphat.io.vn
SMTP_PASS=your_secure_password
SMTP_FROM="Minh Tân Phát Farm" <no-reply@minhtanphat.io.vn>
```

---

## 3. CÁC BƯỚC KHỞI CHẠY (QUICK START)

```bash
# 1. Cài đặt toàn bộ dependencies
pnpm install

# 2. Khởi chạy cụm cơ sở dữ liệu Supabase local (nếu dùng local)
npx supabase start

# 3. Chạy kiểm tra TypeScript & Toàn bộ test suite
pnpm typecheck
pnpm test

# 4. Chạy chế độ phát triển (Development)
pnpm dev

# 5. Build bản sản xuất (Production Build)
pnpm build
pnpm start
```
