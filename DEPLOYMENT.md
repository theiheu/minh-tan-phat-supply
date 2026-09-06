# Triển khai self-host (VPS / máy trại)

Hướng dẫn đưa hệ thống vào hoạt động thật trên máy chủ của bạn (VPS hoặc máy đặt tại
trại), chạy toàn bộ bằng Docker:

- **Supabase self-host** (Postgres + Auth + Storage + API gateway) — nền dữ liệu.
- **App Next.js** (image `Dockerfile` trong repo này) — giao diện.
- **Caddy/Nginx** — reverse proxy + HTTPS.

> Nguồn chính thức Supabase self-host: https://supabase.com/docs/guides/self-hosting/docker
> Lưu ý: stack local của `supabase start` (CLI) **không** dùng cho production.

---

## 0a. Giai đoạn 1 — chạy production ngay trên máy dev

> **Trạng thái hiện tại (tạm thời):** web production đang chạy **ngay trên máy dev** (WSL), chưa dùng Docker — chạy được thật để dùng/test hằng ngày cho tới khi lên VPS theo các mục 1–8 bên dưới. Git flow (`main` = production) giữ nguyên xuyên suốt.

Có **2 thư mục repo riêng biệt** trên máy dev:

| Thư mục | Vai trò | Cổng |
|---|---|---|
| `~/minh-tan-phat-supply` (repo này) | phát triển — sửa code, reload nóng | dev `bun run dev` → **3001** |
| `~/apps/mtp-prod` (clone nhánh `main`) | web chính production — systemd `mtp-web` quản lý | **3000** |

Sửa code ở repo dev **không ảnh hưởng** web chính đang chạy. Muốn đưa code mới lên web chính thì chạy deploy (dưới đây).

### Setup lần đầu (chỉ chạy 1 lần)

```bash
bash scripts/setup-prod.sh          # clone/pull ~/apps/mtp-prod + tạo .env.production + build lần đầu
# Cài systemd unit (template có sẵn: scripts/systemd/mtp-web.service):
sudo cp scripts/systemd/mtp-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mtp-web
```

### Deploy code mới lên web chính

```bash
bash scripts/deploy.sh
```

`deploy.sh` chạy từ repo dev: pull `main` về `~/apps/mtp-prod` → build ra `.next-new` (không đụng bản đang chạy) → swap sang `.next` → `sudo systemctl restart mtp-web` → health check `http://127.0.0.1:3000/login` (tối đa 60s). Build lỗi hoặc health check fail → **tự động giữ/khôi phục bản cũ**, web không bị chết.

### Rollback theo commit

```bash
cd ~/apps/mtp-prod && git reset --hard <sha> && bun run build && sudo systemctl restart mtp-web
```

### Log & quản lý service

```bash
journalctl -u mtp-web -f        # xem log web chính (Ctrl+C để thoát)
sudo systemctl restart mtp-web  # restart
sudo systemctl stop mtp-web     # dừng hẳn
```

### Lưu ý

- Dev và prod đang **dùng chung Supabase local** (dữ liệu test) — không chạy migration phá dữ liệu khi web đang chạy. Sau khi WSL reboot, nếu web báo lỗi DB thì chạy `bash scripts/dev-up.sh` để đưa Supabase local lên lại.
- **Khi lên VPS:** phần Giai đoạn 1 này được **thay bằng deploy Docker** ở các mục 1–8 phía dưới; Git flow giữ nguyên.

---

## 0. Kiến trúc tổng quan

```
Internet
   │  (443)
   ▼
Caddy / Nginx  (reverse proxy + HTTPS)
   ├── app.example.com   ──►  127.0.0.1:3000   (app Next.js)
   └── api.example.com   ──►  127.0.0.1:8000   (Supabase API gateway)
```

Biến môi trường quan trọng của app:

| Biến | Ý nghĩa | Ví dụ |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL API Supabase mà **trình duyệt** gọi được | `https://api.example.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (public) | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (server-only) | `eyJ...` |
| `NEXT_PUBLIC_SITE_URL` | URL gốc của app | `https://app.example.com` |

---

## 1. Chuẩn bị máy

1. Một VPS (hoặc máy tại trại) chạy **Ubuntu 22.04/24.04**, tối thiểu 2 CPU / 4 GB RAM / 20 GB disk.
2. Một tên miền (hoặc 2 subdomain): `app.example.com` + `api.example.com`, trỏ bản ghi A về IP máy.
3. Cài Docker + Docker Compose plugin:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # đăng nhập lại để dùng docker không cần sudo
   ```

---

## 2. Deploy Supabase self-host

1. Tạo thư mục riêng và lấy compose chính thức:
   ```bash
   mkdir -p ~/supabase && cd ~/supabase
   # Tải thư mục docker/ từ repo chính thức (phiên bản mới nhất)
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker
   ```

2. Cấu hình secrets (bắt buộc — KHÔNG dùng giá trị mặc định lên internet):
   ```bash
   cp .env.example .env
   # Sinh secret ngẫu nhiên (mỗi dòng chạy 1 lần):
   openssl rand -base64 32   # dùng cho POSTGRES_PASSWORD, JWT_SECRET, ...
   openssl rand -hex 16      # dùng cho ANON_KEY / SERVICE_ROLE_KEY phần random
   ```
   Điền vào `.env`: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`,
   `SITE_URL`, `API_EXTERNAL_URL`, `ADDITIONAL_REDIRECT_URLS`… theo đúng hướng dẫn:
   - Tạo keys: https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys
   - Cấu hình Auth: https://supabase.com/docs/guides/self-hosting/auth/config

   > Bộ key (JWT secret, anon, service role) phải **cùng một bộ JWT secret** thì RLS/auth mới khớp.

3. Khởi động stack:
   ```bash
   docker compose up -d
   ```
   Kiểm tra: `docker compose ps` (tất cả healthy). Studio tại `http://IP:8001`.

---

## 3. Nạp schema + dữ liệu nền (migrations + seed)

Repo có sẵn 25 migrations trong `supabase/migrations/` và `supabase/seed.sql` (idempotent).

**Cách 1 — psql trực tiếp (khuyến nghị, dễ kiểm soát):**
```bash
# Lấy POSTGRES_PASSWORD trong supabase/docker/.env
for f in supabase/migrations/*.sql; do
  docker exec -i supabase-db-<suffix> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"
done
docker exec -i supabase-db-<suffix> psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/seed.sql
```
(Tên container DB xem bằng `docker compose ps` — thường chứa `db`.)

**Cách 2 — Supabase CLI:**
```bash
bunx supabase db push --db-url "postgresql://postgres:POSTGRES_PASSWORD@localhost:5432/postgres"
```

---

## 4. Cấu hình Auth (đăng nhập bằng tên đăng nhập)

Hệ thống dùng **tên đăng nhập (username) + mật khẩu do quản lý đặt** — không cần email thật, không gửi email mời nên **không cần cấu hình SMTP**. Supabase Auth chỉ dùng email nội bộ tự sinh (`username@mtp.local`) phía sau:

- `SITE_URL` = `https://app.example.com` (URL app).
- `ADDITIONAL_REDIRECT_URLS` = `https://app.example.com/**` (an toàn khi có luồng redirect sau này).
- Không bắt buộc cấu hình `GOTRUE_SMTP_*`. Nếu cần đặt lại mật khẩu cho user, dùng màn hình Quản trị → Người dùng → Đổi mật khẩu (hoặc Studio Authentication khi chưa có manager).

---

## 5. Deploy app Next.js

1. Tạo file env cho app trên máy chủ (copy từ `.env.example`):
   ```bash
   cd ~/minh-tan-phat-supply   # clone repo
   cp .env.example .env
   # Điền:
   #   NEXT_PUBLIC_SUPABASE_URL=https://api.example.com
   #   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key ở bước 2>
   #   SUPABASE_SERVICE_ROLE_KEY=<service role key ở bước 2>
   #   NEXT_PUBLIC_SITE_URL=https://app.example.com
   ```

2. Build & chạy:
   ```bash
   docker compose -f docker-compose.app.yml up -d --build
   ```

3. Kiểm tra log: `docker compose -f docker-compose.app.yml logs -f app`

---

## 6. Reverse proxy + HTTPS (Caddy ví dụ)

`Caddyfile`:
```
app.example.com {
    reverse_proxy 127.0.0.1:3000
}
api.example.com {
    reverse_proxy 127.0.0.1:8000
}
```
Caddy tự xin chứng chỉ Let's Encrypt. (Hoặc dùng Nginx + certbot tương đương.)

> API Supabase cần hỗ trợ WebSocket nếu sau này dùng Realtime; Caddy mặc định đã pass-through.

---

## 7. Đăng nhập lần đầu & tạo user thật

1. Mở `https://app.example.com` → đăng nhập.
2. Tạo tài khoản quản lý kho: vào Studio (Auth) hoặc dùng script:
   ```bash
   bun run scripts/bootstrap.ts   # chỉ khi chưa có user; nhớ đổi mật khẩu mặc định ngay
   ```
3. Tạo người dùng thật bằng màn hình **Quản trị → Người dùng → Tạo tài khoản**: nhập Tên, **Tên đăng nhập** và **Mật khẩu** (quản lý tự đặt, tối thiểu 8 ký tự), rồi báo cho người dùng tên đăng nhập + mật khẩu đó. Không cần email/SMTP.

---

## 8. Vận hành & bảo trì

- **Backup Postgres** (hàng ngày, tự động):
  ```bash
  docker exec -t supabase-db-<suffix> pg_dump -U postgres -d postgres -Fc > backup-$(date +%F).dump
  ```
  Kết hợp `cron` + đẩy bản backup ra nơi khác (Google Drive/S3).
- **Cập nhật**: định kỳ `docker compose pull && docker compose up -d` cho Supabase;
  app thì `git pull && docker compose -f docker-compose.app.yml up -d --build`.
- **Bảo mật**: chỉ mở port 80/443 ra internet; 3000/8000/8001 chỉ bind localhost hoặc firewall nội bộ.
- **Giám sát**: `docker compose ps`, log, và uptime check cho `app.example.com`.

---

## 9. Workflow phát triển tiếp (sau này thêm tính năng)

- Branch: `main` (production), `dev`, `feat/<ten-tinh-nang>`. Commit theo Conventional Commits.
- CI đã chạy tự động (`lint` + `typecheck` + `test`) khi push `main`/`dev`/PR.
- Thêm tính năng động tới DB:
  1. `bunx supabase migration new <ten>` → viết SQL.
  2. `bunx supabase gen types typescript --local > src/types/database.types.ts` (hoặc gen từ DB self-host).
  3. Test local → merge → chạy migration lên server (bước 3) → deploy app.
