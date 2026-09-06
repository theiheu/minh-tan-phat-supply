# Tách Web Production khỏi Dev — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa web chạy bản production build (`next start`, cổng 3000) trong thư mục riêng `~/apps/mtp-prod` do systemd service `mtp-web` quản lý, đẩy dev server sang cổng 3001, và cung cấp `deploy.sh` để cập nhật web an toàn (build lỗi / health fail → giữ hoặc rollback bản cũ).

**Architecture:** Máy WSL có 2 thư mục độc lập: repo dev (sửa code, dev server 3001) và prod clone `~/apps/mtp-prod` tracking `origin/main` (chạy `next start` cổng 3000 qua systemd). `deploy.sh` kéo code mới về prod, build ra `.next-new` (không đụng `.next` đang chạy), swap nguyên khối rồi restart service; nếu build hoặc health check fail thì giữ/khôi phục bản cũ. Dev trên 3001 không bao giờ chạm web 3000. Sau này chuyển sang VPS chỉ đổi "đích deploy" (giữ nguyên Git flow).

**Tech Stack:** Next.js 15 (Turbopack build/start) · Bun · systemd (WSL `systemd=true`) · Supabase local (Docker) · Git/GitHub (`main`)

**Spec:** `docs/superpowers/specs/2026-09-06-dev-prod-separation-design.md`

## Global Constraints

- Dev server luôn chạy cổng **3001**; web production luôn chạy cổng **3000** (không đổi phía Tailscale/portproxy Windows).
- Mọi lệnh deploy/root chạy trên máy WSL này (user `thehi`), repo prod tại `~/apps/mtp-prod` = `$HOME/apps/mtp-prod`.
- Bun binary: `/home/thehi/.bun/bin/bun` (dùng đường dẫn tuyệt đối trong systemd unit).
- `next.config.ts` phải thêm `distDir` đọc `process.env.NEXT_DIST_DIR` (mặc định `.next`) — bắt buộc cho cơ chế build-an-toàn.
- File `.env.production` trong thư mục prod **không commit** (đã chặn bởi `.gitignore` `.env*`); nội dung copy nguyên giá trị từ `.env.local` repo dev (Supabase local hiện tại).
- systemd unit phải có `Restart=always`; cài/enable unit cần `sudo` → bước [USER] do con người chạy trong terminal WSL của họ (agent sandbox không có sudo).
- DB dùng chung dev+prod ở giai đoạn 1 (dữ liệu test) — không chạy migration phá dữ liệu khi web đang chạy.

---

### Task 1: Đẩy dev server sang cổng 3001 + hook `distDir`

**Files:**
- Modify: `package.json` (scripts `dev`, `start`)
- Modify: `next.config.ts`
- Modify: `scripts/dev-up.sh`

**Interfaces:**
- Produces: script `dev` chạy `next dev ... --port 3001`; script `start` chạy `next start -H 0.0.0.0 -p 3000`; `next.config.ts` đọc `NEXT_DIST_DIR` (default `.next`); `dev-up.sh` kiểm tra app ở `http://localhost:3001`.

- [ ] **Step 1: Sửa scripts trong `package.json`**

Từ:
```jsonc
"dev": "next dev --turbopack --hostname 0.0.0.0",
"start": "next start",
```
Thành:
```jsonc
"dev": "next dev --turbopack --hostname 0.0.0.0 --port 3001",
"start": "next start -H 0.0.0.0 -p 3000",
```

- [ ] **Step 2: Thêm `distDir` vào `next.config.ts`**

Trong `const nextConfig: NextConfig = {` thêm dòng đầu tiên:
```ts
  // Cho phép build ra thư mục riêng (deploy.sh build .next-new, không đụng .next đang chạy).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
```

- [ ] **Step 3: Cập nhật `scripts/dev-up.sh` sang cổng 3001**

Sửa dòng:
```bash
APP_URL="http://localhost:3000"
```
→
```bash
APP_URL="http://localhost:3001"
```
Kiểm tra không còn tham chiếu `3000` nào khác ngoài comment API/Studio (Studio vẫn 54323).

- [ ] **Step 4: Xác minh cú pháp & không vỡ gì**

Run: `bun run typecheck` (trong repo dev)
Expected: exit 0, không lỗi TS.

- [ ] **Step 5: Smoke-test dev server ở 3001**

Run: `nohup bun run dev > /tmp/dev3001.log 2>&1 & echo $! > /tmp/dev3001.pid` rồi chờ tối đa 60s:
`curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/login`
Expected: `200`. Sau đó dừng: `kill $(cat /tmp/dev3001.pid)`.

> Lưu ý: nếu dev server cũ đang chiếm 3000 (pid trong `.tmp/dev-server.pid`) thì để nguyên — Task 3 sẽ xử lý khi chuyển sang prod.

- [ ] **Step 6: Commit**

```bash
git add package.json next.config.ts scripts/dev-up.sh
git commit -m "chore(dev): dev server sang cổng 3001, start production -p 3000, distDir hook"
```

---

### Task 2: Viết `deploy.sh` + `setup-prod.sh` + systemd unit template

**Files:**
- Create: `scripts/deploy.sh`
- Create: `scripts/setup-prod.sh`
- Create: `scripts/systemd/mtp-web.service`

**Interfaces:**
- Produces:
  - `deploy.sh` (chạy từ repo dev; dùng `PROD_DIR`, mặc định `$HOME/apps/mtp-prod`): pull `--ff-only origin main` → `bun install --frozen-lockfile` → build `NEXT_DIST_DIR=.next-new` → swap → `sudo systemctl restart mtp-web` → health check `http://127.0.0.1:3000/login` (60s) → fail thì rollback `.next.old`.
  - `setup-prod.sh` (chạy 1 lần, không cần sudo): clone prod repo + tạo `.env.production` (copy từ `.env.local`) + install + build lần đầu.
  - `/etc/systemd/system/mtp-web.service` template trong repo (chưa cài — Task 3 [USER] cài).

- [ ] **Step 1: Tạo `scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
# deploy.sh — cập nhật web production (systemd mtp-web, cổng 3000) từ nhánh main.
# Chạy từ repo dev trên máy này:  bash scripts/deploy.sh
# An toàn: build ra .next-new (không đụng .next đang chạy) → swap → restart.
# Build lỗi => giữ nguyên web cũ. Health check fail => rollback bản cũ.
set -euo pipefail

PROD_DIR="${PROD_DIR:-$HOME/apps/mtp-prod}"
SERVICE="mtp-web"
URL="http://127.0.0.1:3000/login"

cd "$PROD_DIR"

echo "==> [1/6] Kéo code main mới..."
git fetch origin
git pull --ff-only origin main

echo "==> [2/6] Cài dependencies..."
bun install --frozen-lockfile

echo "==> [3/6] Build bản mới (ra .next-new, .next cũ vẫn chạy)..."
rm -rf .next-new
if ! NEXT_DIST_DIR=.next-new bun run build; then
  rm -rf .next-new
  echo "LỖI: build thất bại — GIỮ NGUYÊN web cũ, không restart." >&2
  exit 1
fi

echo "==> [4/6] Swap build mới vào .next..."
rm -rf .next.old
[ -d .next ] && mv .next .next.old
mv .next-new .next

echo "==> [5/6] Restart service $SERVICE..."
sudo systemctl restart "$SERVICE"

echo "==> [6/6] Health check (tối đa 60s)..."
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
    rm -rf .next.old
    echo "DEPLOY OK — web 3000 đang chạy bản mới (restart ~vài giây)."
    exit 0
  fi
  sleep 1
done

echo "==> Health check thất bại — ROLLBACK bản cũ..."
rm -rf .next
[ -d .next.old ] && mv .next.old .next
sudo systemctl restart "$SERVICE"
echo "ROLLBACK XONG — web chạy bản trước. Kiểm tra log: journalctl -u mtp-web -n 50" >&2
exit 1
```

- [ ] **Step 2: Tạo `scripts/setup-prod.sh`**

```bash
#!/usr/bin/env bash
# setup-prod.sh — KHỞI TẠO thư mục production lần đầu (không cần sudo).
# Chạy 1 lần:  bash scripts/setup-prod.sh
# Sau đó cài service theo Task 3 (bước [USER]).
set -euo pipefail

PROD_DIR="${PROD_DIR:-$HOME/apps/mtp-prod}"
REPO_URL="git@github.com:theiheu/minh-tan-phat-supply.git"
DEV_ENV="/home/thehi/minh-tan-phat-supply/.env.local"

mkdir -p "$(dirname "$PROD_DIR")"
if [ ! -d "$PROD_DIR/.git" ]; then
  echo "==> Clone repo vào $PROD_DIR ..."
  git clone "$REPO_URL" "$PROD_DIR"
else
  echo "==> Đã có repo — pull main mới nhất..."
  git -C "$PROD_DIR" pull --ff-only origin main
fi

echo "==> Tạo .env.production (copy từ .env.local của repo dev)..."
if [ ! -f "$DEV_ENV" ]; then
  echo "LỖI: không thấy $DEV_ENV — cần .env.local ở repo dev trước." >&2
  exit 1
fi
cp "$DEV_ENV" "$PROD_DIR/.env.production"

echo "==> bun install..."
(cd "$PROD_DIR" && bun install --frozen-lockfile)

echo "==> Build lần đầu (ra .next-new rồi swap sang .next)..."
(cd "$PROD_DIR" && rm -rf .next-new && NEXT_DIST_DIR=.next-new bun run build)
(cd "$PROD_DIR" && rm -rf .next && mv .next-new .next)

echo ""
echo "SETUP PROD OK — thư mục: $PROD_DIR"
echo "Bước kế: cài systemd service (xem Task 3 — bước [USER])."
```

- [ ] **Step 3: Tạo unit template `scripts/systemd/mtp-web.service`**

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

- [ ] **Step 4: Chmod executable + shellcheck cú pháp**

Run: `chmod +x scripts/deploy.sh scripts/setup-prod.sh`
Run: `bash -n scripts/deploy.sh && bash -n scripts/setup-prod.sh`
Expected: exit 0 (không lỗi cú pháp).

- [ ] **Step 5: Commit**

```bash
git add scripts/deploy.sh scripts/setup-prod.sh scripts/systemd/mtp-web.service
git commit -m "feat(ops): deploy.sh + setup-prod.sh + systemd unit mtp-web"
```

- [ ] **Step 6: Push lên GitHub — BẮT BUỘC trước Task 3**

> `setup-prod.sh` (Task 3) clone từ `origin/main`, nên các commit của Task 1–2
> (nhất là script `start` mới `-p 3000` và hook `distDir`) phải có trên GitHub
> trước khi khởi tạo thư mục prod.

Run:
```bash
git push origin main
```
Expected: push thành công (CI GitHub Actions bắt đầu chạy).

---

### Task 3: Khởi tạo thư mục prod + cài service `mtp-web`

**Files:**
- Create (runtime, ngoài git): `$HOME/apps/mtp-prod/` (clone), `$HOME/apps/mtp-prod/.env.production`, `/etc/systemd/system/mtp-web.service` (bước [USER])

**Interfaces:**
- Consumes: `scripts/setup-prod.sh`, `scripts/systemd/mtp-web.service` (Task 2).
- Produces: web production chạy ở `http://127.0.0.1:3000` (health 200), service `mtp-web` enabled + auto-restart.

> Bước 1–2 chạy được trong agent sandbox nhưng ghi **ngoài** workspace (`~/apps`) → cần quyền mở rộng `danger-full-access` (sẽ xin approval). Nếu bị chặn, chuyển sang chạy thủ công và dán output về.

- [ ] **Step 1: Dừng dev server cũ đang chiếm cổng 3000 (nếu còn)**

Run:
```bash
if [ -f /home/thehi/minh-tan-phat-supply/.tmp/dev-server.pid ]; then
  OLD_PID=$(cat /home/thehi/minh-tan-phat-supply/.tmp/dev-server.pid)
  kill "$OLD_PID" 2>/dev/null && echo "đã dừng dev cũ pid $OLD_PID" || echo "pid $OLD_PID không còn chạy"
  rm -f /home/thehi/minh-tan-phat-supply/.tmp/dev-server.pid
fi
curl -s -o /dev/null -w '3000 -> %{http_code}\n' http://127.0.0.1:3000/login || echo "3000 đã trống"
```
Expected: cổng 3000 trống (không còn process dev chiếm).

- [ ] **Step 2: Chạy `setup-prod.sh` để clone + build lần đầu**

Run: `bash scripts/setup-prod.sh`
Expected: clone OK, `.env.production` được tạo, `bun install` OK, build thành công, in `SETUP PROD OK`.
Verify thư mục: `ls ~/apps/mtp-prod/.next/BUILD_ID` tồn tại.

- [ ] **Step 3 [USER]: Cài + bật service `mtp-web`** (người dùng chạy trong terminal WSL của họ — agent không có sudo)

Đưa cho người dùng chạy:
```bash
sudo cp /home/thehi/minh-tan-phat-supply/scripts/systemd/mtp-web.service /etc/systemd/system/mtp-web.service
sudo systemctl daemon-reload
sudo systemctl enable --now mtp-web
```
Expected output: `Created symlink ... multi-user.target.wants/mtp-web.service` + không lỗi.

- [ ] **Step 4: Verify web production lên**

Run: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login` (lặp tối đa 60s)
Expected: `200`.
Run: `systemctl status mtp-web --no-pager | head -8`
Expected: `active (running)`; log: `journalctl -u mtp-web -n 10 --no-pager` thấy `Ready` / không crash-loop.

- [ ] **Step 5: Verify auto-restart khi process chết**

Run:
```bash
MAIN_PID=$(systemctl show -p MainPID --value mtp-web)
kill -9 "$MAIN_PID"
sleep 8
systemctl is-active mtp-web
curl -s -o /dev/null -w 'sau kill -> %{http_code}\n' http://127.0.0.1:3000/login
```
Expected: `active`, HTTP `200` (systemd `Restart=always` tự gượng dậy).

- [ ] **Step 6: Verify điện thoại vẫn truy cập được**

Run (nếu portproxy Windows còn hiệu lực): `curl -s -o /dev/null -w '%{http_code}\n' http://100.106.149.116:3000/login`
Expected: `200`. Nếu `000` → nhắc người dùng chạy lại `scripts/fix-tailscale-port3000.ps1` (Admin) trên Windows — không thuộc phạm vi agent.

---

### Task 4: Kiểm thử `deploy.sh` — 3 kịch bản

**Files:**
- Test-only: thư mục `~/apps/mtp-prod` (không commit gì từ task này)

**Interfaces:**
- Consumes: `scripts/deploy.sh` (Task 2), service `mtp-web` đang chạy (Task 3).

- [ ] **Step 1 [USER]: Kịch bản A — deploy không có thay đổi (idempotent)**

Người dùng chạy trong terminal WSL (deploy.sh có `sudo systemctl restart`, agent không có sudo):
```bash
cd /home/thehi/minh-tan-phat-supply && bash scripts/deploy.sh
```
Expected: pull báo "Already up to date" (hoặc cập nhật), build OK, restart, in `DEPLOY OK — web 3000 đang chạy bản mới`.
Agent verify sau đó: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login` → `200`.

- [ ] **Step 2: Kịch bản B — build LỖI phải giữ nguyên web cũ**

Tạo 1 file TS cố tình lỗi trong prod (KHÔNG commit):
```bash
cd ~/apps/mtp-prod
echo 'export const broken = ;' > src/zz-broken-test.ts
NEXT_DIST_DIR=.next-new bun run build
echo "build exit code: $?"   # mong đợi != 0
rm -f src/zz-broken-test.ts
```
Expected: build fail (`exit code` ≠ 0), `.next` cũ **không bị đụng**, web 3000 vẫn 200:
`curl -s -o /dev/null -w 'web sau build lỗi -> %{http_code}\n' http://127.0.0.1:3000/login`

> Lưu ý: kiểm tra bằng lệnh build trực tiếp (không qua deploy.sh) để không làm bẩn git prod; `deploy.sh` tự dừng ở bước build khi fail nên hành vi tương đương.

- [ ] **Step 3 [USER]: Kịch bản C — deploy 1 commit thật (end-to-end)**

Trong repo dev, tạo 1 thay đổi vô hại có thể quan sát được trên web (ví dụ thêm text vào trang login) → commit → push `main` (CI chạy) → người dùng chạy:
```bash
cd /home/thehi/minh-tan-phat-supply && bash scripts/deploy.sh
```
Expected: deploy OK. Agent verify: mở `http://127.0.0.1:3000/login` xác nhận nội dung mới xuất hiện; dev 3001 vẫn chạy độc lập (`curl http://localhost:3001/login` → 200).

> Nếu chưa có thay đổi thật nào để deploy, dùng chính commit của Task 3 (đã push) làm đối tượng và chỉ verify "deploy OK" + web 200.

---

### Task 5: Cập nhật tài liệu người dùng

**Files:**
- Modify: `README.md`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Produces: hướng dẫn vận hành 1 trang (chạy dev 3001, web chính 3000, deploy, rollback, log, tắt service, ghi chú DB dùng chung + Supabase sau reboot).

- [ ] **Step 1: Cập nhật `README.md`**

Thêm ngay sau phần "Khởi động" (giữ nguyên nội dung cũ, chỉ bổ sung) một khối:

````md
## Phát triển & vận hành (tách web chính khỏi code)

| Việc | Lệnh |
|---|---|
| Chạy dev (sửa code, reload nóng) | `bun run dev` → http://localhost:**3001** |
| Web chính (production) | http://localhost:**3000** — do systemd `mtp-web` quản lý |
| Update web chính từ code mới | `bash scripts/deploy.sh` (build lỗi/health fail tự giữ bản cũ) |
| Xem log web chính | `journalctl -u mtp-web -f` |
| Restart / dừng web chính | `sudo systemctl restart mtp-web` / `sudo systemctl stop mtp-web` |

Web chính chạy bản build trong `~/apps/mtp-prod` — **sửa code ở repo này không ảnh hưởng web đang chạy**. Sau khi WSL reboot, nếu web báo lỗi DB thì chạy `bash scripts/dev-up.sh` (chỉ để Supabase local lên; phần dev 3001 chạy không bắt buộc). Dev và prod đang **dùng chung DB** (dữ liệu test) — không chạy migration phá dữ liệu khi web đang chạy.
````

- [ ] **Step 2: Cập nhật `DEPLOYMENT.md`**

Thêm mục mới "## 0a. Giai đoạn 1 — chạy production ngay trên máy dev" trước mục "## 0. Kiến trúc tổng quan", nội dung:
- Mô tả 2 thư mục (dev 3001 / prod 3000 + systemd `mtp-web`).
- Các lệnh: setup lần đầu (`bash scripts/setup-prod.sh` + cài unit), deploy (`bash scripts/deploy.sh`), rollback theo commit (`cd ~/apps/mtp-prod && git reset --hard <sha> && bun run build && sudo systemctl restart mtp-web`).
- Ghi rõ: khi lên VPS, phần này được thay bằng Docker deploy ở các mục sau; Git flow giữ nguyên.

- [ ] **Step 3: Commit**

```bash
git add README.md DEPLOYMENT.md
git commit -m "docs(ops): hướng dẫn phát triển & vận hành web production/dev"
```

---

### Task 6: Push `main` + nghiệm thu cuối

**Files:**
- Push: toàn bộ commit của các Task 1, 2, 5 (Task 3–4 là runtime, không commit)

- [ ] **Step 1: Push lên GitHub**

Run: `git push origin main`
Expected: push thành công; CI (lint/typecheck/test) chạy trên GitHub Actions.

- [ ] **Step 2: Chạy checklist nghiệm thu theo spec**

- [ ] `bun run dev` ở 3001 và web 3000 cùng chạy, cả 2 trả HTTP 200.
- [ ] `sudo systemctl enable --now mtp-web` đã xong (Task 3), service active.
- [ ] Kill process web → tự restart (đã verify Task 3 Step 5).
- [ ] `deploy.sh` với build lỗi → giữ web cũ (Task 4 Step 2).
- [ ] `deploy.sh` với commit mới → web 3000 có nội dung mới (Task 4 Step 3).
- [ ] Điện thoại `http://100.106.149.116:3000` truy cập OK (hoặc đã nhắc user chạy lại script portproxy).
- [ ] CI GitHub xanh trên commit cuối.

- [ ] **Step 3: Báo cáo tổng kết cho người dùng**

Tóm tắt: kiến trúc mới, các lệnh vận hành chính (bảng README), điều gì KHÔNG đổi (Tailscale 3000), bước kế tiếp (VPS — đã có DEPLOYMENT.md).
