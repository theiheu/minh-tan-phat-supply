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
