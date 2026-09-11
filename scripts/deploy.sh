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
git fetch origin || true
git pull --ff-only origin main || true

echo "==> [2/6] Cài dependencies..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
elif command -v bun >/dev/null 2>&1; then
  bun install
else
  npm install
fi

echo "==> [3/6] Build bản mới (ra .next-new, .next cũ vẫn chạy)..."
rm -rf .next-new
BUILD_CMD="pnpm build"
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v bun >/dev/null 2>&1; then
    BUILD_CMD="bun run build"
  else
    BUILD_CMD="npm run build"
  fi
fi

if ! NEXT_DIST_DIR=.next-new $BUILD_CMD; then
  rm -rf .next-new
  echo "LỖI: build thất bại — GIỮ NGUYÊN web cũ, không restart." >&2
  exit 1
fi

echo "==> [4/6] Swap build mới vào .next..."
rm -rf .next.old
[ -d .next ] && mv .next .next.old
mv .next-new .next

restart_or_rollback() {
  echo "==> Restart service $SERVICE..."
  if systemctl restart "$SERVICE" 2>/dev/null || sudo systemctl restart "$SERVICE" 2>/dev/null; then
    echo "==> Health check (tối đa 60s)..."
    for i in $(seq 1 60); do
      if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
        rm -rf .next.old
        echo "DEPLOY OK — web 3000 đang chạy bản mới (restart ~vài giây)."
        exit 0
      fi
      sleep 1
    done
  else
    echo "WARN: restart lệnh thất bại — chuyển sang rollback." >&2
  fi

  echo "==> Health check thất bại / restart lỗi — ROLLBACK bản cũ..."
  rm -rf .next
  [ -d .next.old ] && mv .next.old .next
  systemctl restart "$SERVICE" 2>/dev/null || sudo systemctl restart "$SERVICE" 2>/dev/null || true
  echo "ROLLBACK XONG — web chạy bản trước. Kiểm tra log: journalctl -u mtp-web -n 50" >&2
  exit 1
}

restart_or_rollback
