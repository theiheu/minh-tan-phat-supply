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

if [ -f "$PROD_DIR/.env.production" ]; then
  echo "==> .env.production đã tồn tại — giữ nguyên (không ghi đè)."
else
  echo "==> Tạo .env.production (copy từ .env.local của repo dev)..."
  if [ ! -f "$DEV_ENV" ]; then
    echo "LỖI: không thấy $DEV_ENV — cần .env.local ở repo dev trước." >&2
    exit 1
  fi
  cp "$DEV_ENV" "$PROD_DIR/.env.production"
fi

echo "==> bun install..."
(cd "$PROD_DIR" && bun install --frozen-lockfile)

echo "==> Build lần đầu (ra .next-new rồi swap sang .next)..."
(cd "$PROD_DIR" && rm -rf .next-new && NEXT_DIST_DIR=.next-new bun run build)
(cd "$PROD_DIR" && rm -rf .next && mv .next-new .next)

echo ""
echo "SETUP PROD OK — thư mục: $PROD_DIR"
echo "Bước kế: cài systemd service (xem Task 3 — bước [USER])."
