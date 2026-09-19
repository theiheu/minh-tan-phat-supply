# 🛠️ DANH MỤC CLI SCRIPTS VẬN HÀNH & KIỂM THỬ (CLI SCRIPTS REFERENCE)

> Tài liệu tham chiếu chi tiết toàn bộ các tập lệnh (Scripts) trong thư mục `scripts/` phục vụ khởi chạy, triển khai tự động, nạp dữ liệu mẫu (Seed), đồng bộ AI, kiểm thử dòng nghiệp vụ và đo hiệu năng hệ thống **Minh Tân Phát Supply**.

---

## 1. SCRIPTS KHỞI CHẠY & TRIỂN KHAI HỆ THỐNG

### `scripts/dev-up.sh` & `scripts/dev-down.sh`
* **Mục đích:** Khởi động hoặc dừng môi trường phát triển (Dev Server) trên cổng **3001** với thư mục build riêng biệt (`.next-dev`), không ảnh hưởng đến web chính đang chạy.
* **Cách chạy:**
```bash
bash scripts/dev-up.sh      # Bật dev server
bash scripts/dev-down.sh    # Tắt sạch tiến trình dev
```

### `scripts/deploy.sh` (hoặc `pnpm deploy:prod` / `pnpm prod`)
* **Mục đích:** Script triển khai Web Production (Cổng **3000**) an toàn không gián đoạn (Zero-Downtime Deployment).
* **Quy trình thực thi:**
  1. Pull mã nguồn mới nhất từ nhánh `main`.
  2. Build Next.js ra thư mục tạm `.next-new` (không ghi đè lên bản đang chạy).
  3. Nếu build thành công: Tráo đổi thư mục sang `.next` và khởi động lại `sudo systemctl restart mtp-web`.
  4. Health check tự động `http://127.0.0.1:3000/login` trong tối đa 60 giây. Nếu lỗi, tự động hoàn tác về bản cũ an toàn.
* **Cách chạy:**
```bash
bash scripts/deploy.sh
```

### `scripts/setup-prod.sh`
* **Mục đích:** Thiết lập môi trường Production lần đầu tiên trên máy chủ (tạo thư mục production, cấu hình `.env.production` và cài đặt systemd service).

---

## 2. SCRIPTS NẠP DỮ LIỆU, EMAIL & TRI THỨC AI

### `scripts/seed-complete-data.ts` (hoặc `pnpm seed:complete`)
* **Mục đích:** Nạp toàn bộ dữ liệu mẫu hoàn chỉnh: 7 vai trò người dùng chuẩn, danh mục ngành hàng, SKU, đơn vị quy đổi, định mức BOM, trạm bồn dầu, dàn xe cơ giới và lịch sử phiếu mẫu.
* **Cách chạy:**
```bash
pnpm seed:complete
```

### `scripts/ensure-superuser.ts`
* **Mục đích:** Kiểm tra và đảm bảo tài khoản Quản trị cấp cao (`superuser`) luôn tồn tại trong hệ thống, tự động khôi phục nếu bị thiếu.
* **Cách chạy:**
```bash
npx tsx scripts/ensure-superuser.ts
```

### `scripts/assign-user-emails.ts` (hoặc `pnpm assign:emails`)
* **Mục đích:** Tự động gán và đồng bộ địa chỉ email doanh nghiệp SMTP cho toàn bộ tài khoản nhân sự trong trại.

### `scripts/sync-knowledge.ts` (hoặc `pnpm sync:knowledge`)
* **Mục đích:** Quét tài liệu tri thức trong `docs/`, thực hiện pipeline phân mảnh (chunking) và sinh vector embeddings nạp vào `ai_knowledge_chunks` cho AI Copilot.
* **Cách chạy:**
```bash
pnpm sync:knowledge
```

### `scripts/test-email.ts` & `scripts/send-reminders-job.ts`
* **Mục đích:** Kiểm tra kết nối SMTP gửi email thử nghiệm và chạy worker gửi email nhắc nhở mượn dụng cụ quá hạn định kỳ.

---

## 3. SCRIPTS ĐO HIỆU NĂNG, VALIDATION & IN ẤN

### `scripts/validate-manifest.js`
* **Mục đích:** Kiểm tra tính hợp lệ của manifest trạng thái triển khai tại `docs/operations/current-deployment-status.yaml`.
* **Cách chạy:**
```bash
node scripts/validate-manifest.js
```

### `scripts/benchmark-pages.js`
* **Mục đích:** Đo lường thời gian phản hồi (Latency) và tốc độ tải trang thực tế của toàn bộ 25+ màn hình trong hệ thống, đảm bảo đạt chuẩn tốc độ ~200ms.
* **Cách chạy:**
```bash
node scripts/benchmark-pages.js
```

### `scripts/verify-pdf-font.tsx` & `scripts/test-vehicle-qr-pdf.tsx`
* **Mục đích:** Kiểm tra tính toàn vẹn của font tiếng Việt UTF-8 `Roboto` và kiểm tra khả năng render vector PDF cho tem nhãn mã QR dán xe cơ giới.

---

## 4. SCRIPTS KIỂM THỬ DÒNG NGHIỆP VỤ ĐẦU CUỐI (E2E VERIFICATION)

Bộ tập lệnh kiểm thử tự động độc lập từng luồng nghiệp vụ trên cơ sở dữ liệu thật:

| Tập lệnh | Nghiệp vụ kiểm tra | Lệnh chạy |
|---|---|---|
| `verify-username-login.ts` | Đăng nhập bằng Username không cần email & Trigger khóa họ tên. | `npx tsx scripts/verify-username-login.ts` |
| `verify-receipt-flow.ts` | Nhập kho NCC, upload hóa đơn VAT & tự động cấp phát phiếu đã duyệt. | `npx tsx scripts/verify-receipt-flow.ts` |
| `verify-requisition-flow.ts` | Quy trình yêu cầu vật tư duyệt 2 cấp & xác nhận nhận hàng 2 chiều. | `npx tsx scripts/verify-requisition-flow.ts` |
| `verify-issue-flow.ts` | Xuất kho trực tiếp theo Dãy trại (`sub_zone`) & xuất bán. | `npx tsx scripts/verify-issue-flow.ts` |
| `verify-defect-exchange.ts` | Đổi 1-1 motor cháy cấp tốc trong 30 giây & nạp kho hỏng. | `npx tsx scripts/verify-defect-exchange.ts` |
| `verify-exchange-repair.ts` | Vòng đời sửa chữa thiết bị cơ điện & nghiệm thu nhập lại kho. | `npx tsx scripts/verify-exchange-repair.ts` |
| `verify-fuel-flow.ts` | Quét QR đổ dầu xe ben, nhập ODO & tính định mức $L/100km$. | `npx tsx scripts/verify-fuel-flow.ts` |
| `verify-stocktake.ts` | Mở phiên kiểm kê, tính chênh lệch thừa/thiếu & duyệt cân bằng. | `npx tsx scripts/verify-stocktake.ts` |
| `verify-image-permissions.ts`| Phân quyền upload và xóa ảnh hóa đơn trên Supabase Storage. | `npx tsx scripts/verify-image-permissions.ts` |
