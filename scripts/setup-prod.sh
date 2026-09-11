#!/usr/bin/env bash
# setup-prod.sh — KHỞI TẠO thư mục production lần đầu.
# Chạy 1 lần:  bash scripts/setup-prod.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROD_DIR="${PROD_DIR:-$HOME/apps/mtp-prod}"
REPO_URL="https://github.com/theiheu/minh-tan-phat-supply.git"
DEV_ENV="$DEV_DIR/.env.local"

mkdir -p "$(dirname "$PROD_DIR")"
if [ ! -d "$PROD_DIR/.git" ]; then
  echo "==> Clone repo vào $PROD_DIR ..."
  git clone "$DEV_DIR" "$PROD_DIR" || git clone "$REPO_URL" "$PROD_DIR"
  git -C "$PROD_DIR" remote set-url origin "$REPO_URL" || true
else
  echo "==> Đã có repo — cập nhật mới nhất..."
  git -C "$PROD_DIR" pull --ff-only origin main || true
fi

if [ -f "$PROD_DIR/.env.production" ]; then
  echo "==> .env.production đã tồn tại — giữ nguyên (không ghi đè)."
else
  echo "==> Tạo .env.production (copy từ .env.local của repo dev)..."
  if [ -f "$DEV_ENV" ]; then
    cp "$DEV_ENV" "$PROD_DIR/.env.production"
    cp "$DEV_ENV" "$PROD_DIR/.env.local"
  fi
fi

echo "==> Cài đặt dependencies cho production..."
if command -v pnpm >/dev/null 2>&1; then
  (cd "$PROD_DIR" && pnpm install)
elif command -v bun >/dev/null 2>&1; then
  (cd "$PROD_DIR" && bun install)
else
  (cd "$PROD_DIR" && npm install)
fi

echo "==> Build lần đầu (ra .next-new rồi swap sang .next)..."
if command -v pnpm >/dev/null 2>&1; then
  (cd "$PROD_DIR" && rm -rf .next-new && NEXT_DIST_DIR=.next-new pnpm build)
elif command -v bun >/dev/null 2>&1; then
  (cd "$PROD_DIR" && rm -rf .next-new && NEXT_DIST_DIR=.next-new bun run build)
else
  (cd "$PROD_DIR" && rm -rf .next-new && NEXT_DIST_DIR=.next-new npm run build)
fi
(cd "$PROD_DIR" && rm -rf .next && mv .next-new .next)

echo ""
echo "SETUP PROD OK — thư mục: $PROD_DIR"
