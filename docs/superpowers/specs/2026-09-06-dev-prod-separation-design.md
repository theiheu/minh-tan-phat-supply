# Tách Web đang chạy (production) khỏi nơi sửa code (dev) — Design

- Ngày: 2026-09-06
- Trạng thái: Thiết kế chờ người dùng duyệt
- Phạm vi: quy trình vận hành + phát triển của toàn repo `minh-tan-phat-supply`

## 1. Bối cảnh & mục tiêu

Hiện web (máy WSL này) chạy bằng **dev server** (`bun run dev` trên cổng 3000):
server compile trực tiếp từ code đang sửa → lỗi code = web lỗi theo; server cũng hay
bị dừng vì không có cơ chế giữ (dính vòng đời phiên làm việc). Người dùng sợ **sửa
code ảnh hưởng web đang chạy**.

Mục tiêu (đã chốt với người dùng):

1. **Web đang chạy = bản production build** (`next start`) ở thư mục riêng, do
   systemd quản lý (tự start khi WSL bật, tự restart khi chết), cổng **3000** —
   đúng cổng Tailscale đang trỏ, không đổi gì phía điện thoại.
2. **Nơi sửa code tách hẳn**: thư mục dev hiện tại, dev server chuyển sang cổng
   **3001** (chỉ truy cập local để test). Sửa code / code lỗi không chạm web 3000.
3. **Update bằng 1 lệnh**: `deploy.sh` kéo code `main` mới về thư mục prod →
   build → **chỉ restart khi build thành công** (lỗi giữ bản cũ) → health check,
   có rollback.
4. Chấp nhận **restart vài giây** mỗi lần update (đã chốt).
5. Giai đoạn sau: dời sang VPS (Supabase self-host + Docker + Caddy + domain) —
   thiết kế hiện tại giữ nguyên quy trình Git, chỉ đổi "đích deploy".

Phạm vi KHÔNG làm bây giờ: deploy VPS, domain/HTTPS, tách DB dev/prod.

## 2. Hiện trạng liên quan (đã rà)

- `package.json`: `dev = next dev --turbopack --hostname 0.0.0.0` (mặc định port 3000);
  `start = next start`; `build = next build --turbopack`. Chạy bằng **Bun**
  (`/home/thehi/.bun/bin/bun`).
- `scripts/dev-up.sh` / `dev-down.sh`: quản lý Supabase local + dev server port
  **3000**, pid/log tại `.tmp/dev-server.{pid,log}`.
- Env đọc **runtime** qua `process.env` (`src/lib/env.ts`, zod; `getPublicEnv` cache
  request-time); `NEXT_PUBLIC_*` được bake vào bundle **lúc build**. `.env.local`
  hiện trỏ Supabase local `http://127.0.0.1:54321` + anon/service keys.
- Supabase local chạy bằng Docker (containers `supabase_*`, API 54321, Studio 54323) —
  đang healthy. Docker là systemd service (`enabled/active`).
- WSL có `systemd=true` (`/etc/wsl.conf`). Git remote `origin` = GitHub
  (`theiheu/minh-tan-phat-supply`), nhánh `main`; CI chạy lint/typecheck/test khi
  push `main`/`dev`.
- Truy cập từ điện thoại: Tailscale IP Windows `100.106.149.116:3000` →
  `netsh portproxy` → WSL-IP:3000 (script `scripts/fix-tailscale-port3000.ps1`).
- Đã có `Dockerfile` + `docker-compose.app.yml` + `DEPLOYMENT.md` (cho giai đoạn VPS).

## 3. Kiến trúc đích (Giai đoạn 1 — máy này)

```
MÁY WSL
├── THƯ MỤC DEV  /home/thehi/minh-tan-phat-supply   (sửa code, git main/dev)
│     bun run dev  →  http://localhost:3001         (hot reload, chỉ local)
│
├── THƯ MỤC PROD  ~/apps/mtp-prod                    (clone riêng, tracking origin/main)
│     bun run build  (lúc deploy)  →  bun run start  →  cổng 3000 (0.0.0.0)
│     systemd service: mtp-web  (Restart=always, User=thehi)
│
├── Supabase local (Docker) — DB dùng chung cho dev + prod (GĐ1: dữ liệu test)
└── systemd: docker.service (đã chạy) + mtp-web.service (mới)
```

Luồng cập nhật web (sau khi code xong, đã test ở 3001, đã push `main`):

```
deploy.sh
  → git pull --ff-only origin main  (trong ~/apps/mtp-prod)
  → bun install --frozen-lockfile
  → bun run build          (lỗi → dừng, KHÔNG restart — web cũ vẫn chạy)
  → backup .next cũ        (.next.prev-<ts>)
  → systemctl restart mtp-web
  → health check GET /login → 200? OK : khôi phục .next cũ + restart
```

## 4. Thay đổi chi tiết

### 4.1 `package.json` — đẩy dev sang cổng 3001

```jsonc
"dev": "next dev --turbopack --hostname 0.0.0.0 --port 3001",
"start": "next start -H 0.0.0.0 -p 3000",   // chủ động ghi rõ (prod)
```

### 4.2 `scripts/dev-up.sh` / `dev-down.sh` — cập nhật cổng 3001

- `APP_URL=http://localhost:3001` (đổi từ 3000), đổi các thông báo tương ứng.
- Giữ nguyên phần Supabase (không đổi).

### 4.3 Thư mục prod `~/apps/mtp-prod` (clone riêng, KHÔNG worktree)

- `git clone git@github.com:theiheu/minh-tan-phat-supply.git ~/apps/mtp-prod`
- Tạo `.env.production` trong đó (copy giá trị từ `.env.local` của repo dev —
  cùng URL/key Supabase local). `next build`/`next start` tự đọc `.env.production`
  khi `NODE_ENV=production`; file này **không commit**, nằm ngoài git.

### 4.4 systemd service `mtp-web`

File `/etc/systemd/system/mtp-web.service`:

```ini
[Unit]
Description=MTP production web (next start, port 3000)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=thehi
WorkingDirectory=/home/thehi/apps/mtp-prod
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
ExecStart=/home/thehi/.bun/bin/bun run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Cài: `sudo cp ... && sudo systemctl daemon-reload && sudo systemctl enable --now mtp-web`.
Log: `journalctl -u mtp-web -f`. Tắt hẳn: `sudo systemctl disable --now mtp-web`.

> Lưu ý: vì chạy qua systemd (không qua shell login), env lấy từ
> `.env.production` trong `WorkingDirectory` (Next tự nạp) — không cần `EnvironmentFile`
> ngoài 2 dòng `Environment` ở trên.

### 4.5 `scripts/deploy.sh` (mới, trong repo dev, chạy trên máy này)

> **An toàn khi build:** `next build` xoá sạch `.next` ngay khi bắt đầu → nếu build
> ngay trong `.next` đang chạy thì server mất asset giữa chừng và không còn bản cũ
> để rollback. Vì vậy build ra thư mục riêng rồi **swap nguyên khối**:

1. `cd ~/apps/mtp-prod`; `git fetch origin && git pull --ff-only origin main`
   (không ff → báo lỗi dừng, tránh mất đồng bộ).
2. `bun install --frozen-lockfile`
3. Build ra thư mục tạm (bản cũ `.next` **không bị đụng**, server vẫn chạy):
   `NEXT_DIST_DIR=.next-new bun run build` — fail → `rm -rf .next-new`, `exit 1`,
   **web cũ vẫn chạy nguyên vẹn**.
4. Swap: `rm -rf .next.old && mv .next .next.old && mv .next-new .next`
5. `sudo systemctl restart mtp-web`
6. Health check: curl `http://127.0.0.1:3000/login` → 200 trong ~60s.
7. Fail → rollback tức thì: `rm -rf .next && mv .next.old .next`,
   `sudo systemctl restart mtp-web`, báo lỗi.
8. OK → `rm -rf .next.old`, in "Deploy OK — web 3000 vừa restart".

Rollback theo commit (khi cần lùi code hẳn):
`cd ~/apps/mtp-prod && git reset --hard <sha cũ> && bun run build &&
sudo systemctl restart mtp-web`.

### 4.6 Điều chỉnh hỗ trợ build ra thư mục riêng

- `next.config.ts`: thêm `distDir: process.env.NEXT_DIST_DIR ?? ".next"` (mặc định
  không đổi hành vi; deploy.sh set `NEXT_DIST_DIR` để build ra `.next-new`).
- `.gitignore`: thêm `.next-new/`, `.next.old/` (phòng khi nằm trong repo dev).

### 4.7 Tài liệu người dùng

- Cập nhật `README.md`: bảng "chạy dev (3001) / web chính (3000) / deploy / rollback /
  log" ngắn gọn tiếng Việt.
- Cập nhật `DEPLOYMENT.md`: thêm mục "Giai đoạn 1 — chạy production ngay trên máy
  dev (mtp-web + deploy.sh)" trước phần VPS hiện có.

## 5. Luồng phát triển chuẩn từ nay

1. Sửa code ở `/home/thehi/minh-tan-phat-supply` → test ở `http://localhost:3001`
   (web 3000 không bị ảnh hưởng gì).
2. `bun run lint` + `bun run typecheck` + `bun run test`.
3. Commit + push `main` (CI tự kiểm tra lại).
4. `bash scripts/deploy.sh` → web 3000 restart với bản mới (vài giây).

## 6. Rủi ro & lưu ý

- **DB dùng chung (dev + prod) ở GĐ1**: migration/seed chạy ở dev sẽ ảnh hưởng DB
  mà web 3000 đang dùng. Chấp nhận vì đang là dữ liệu test; khi lên VPS (GĐ2) tách
  DB hẳn. Ghi rõ vào README: không chạy migration phá dữ liệu khi web đang "sống".
- Build bake `NEXT_PUBLIC_*` từ `.env.production` của thư mục prod — nếu đổi
  URL/key Supabase phải sửa cả file đó rồi deploy lại.
- `deploy.sh` cần `sudo systemctl restart` — lần đầu chạy sẽ xin mật khẩu/approval.
- WSL restart → `mtp-web` tự chạy lại; nhưng Supabase local (docker) chỉ tự chạy nếu
  docker containers có restart policy / `supabase start` lại. GĐ1 coi như máy hiếm
  reboot; ghi chú trong README: sau reboot máy, nếu web 3000 lỗi DB thì chạy
  `bash scripts/dev-up.sh` (phần Supabase) — deploy.sh chỉ lo phần web.

## 7. Checklist nghiệm thu

- [ ] `bun run dev` chạy ở 3001, web 3000 (prod) vẫn 200 trong lúc dev đang chạy.
- [ ] `sudo systemctl enable --now mtp-web` → sau `systemctl restart` web 3000 lên lại.
- [ ] `deploy.sh` với 1 commit mới (sửa nhỏ vô hại) → web 3000 có nội dung mới.
- [ ] `deploy.sh` với code cố tình lỗi build → báo lỗi, web 3000 vẫn chạy bản cũ.
- [ ] Kill thử process web → systemd tự restart trong vài giây.
- [ ] Điện thoại truy cập `100.106.149.116:3000` OK (portproxy Windows giữ nguyên).
