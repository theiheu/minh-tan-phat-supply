#!/usr/bin/env bash
# deploy.sh — Đồng bộ code từ dev (3001) sang production (3000) và reload hệ thống
# Sử dụng:  pnpm deploy   (hoặc   bash scripts/deploy.sh)
set -euo pipefail

DEV_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROD_DIR="${PROD_DIR:-$HOME/apps/mtp-prod}"
SERVICE="mtp-web"
URL="http://127.0.0.1:3000/login"

echo "=================================================="
echo "🚀 [1/5] Bắt đầu deploy sang Production (Port 3000)"
echo "   Nguồn dev:  $DEV_DIR"
echo "   Đích prod:  $PROD_DIR"
echo "=================================================="

# 1. Đảm bảo thư mục prod tồn tại
mkdir -p "$PROD_DIR"

# 2. Đồng bộ mã nguồn từ dev sang prod (loại trừ các thư mục tạm / cache)
echo "==> [2/5] Đồng bộ mã nguồn..."
if command -v rsync >/dev/null 2>&1; then
  rsync -av --delete \
    --exclude='.git' \
    --exclude='.next' \
    --exclude='.next-dev' \
    --exclude='.next-new' \
    --exclude='.next.old' \
    --exclude='.tmp' \
    --exclude='node_modules' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    "$DEV_DIR/" "$PROD_DIR/"
else
  # Fallback cp nếu không có rsync
  cp -r "$DEV_DIR/src" "$PROD_DIR/"
  cp -r "$DEV_DIR/public" "$PROD_DIR/" 2>/dev/null || true
  cp -r "$DEV_DIR/scripts" "$PROD_DIR/" 2>/dev/null || true
  cp "$DEV_DIR/next.config.ts" "$PROD_DIR/" 2>/dev/null || true
  cp "$DEV_DIR/package.json" "$PROD_DIR/"
  cp "$DEV_DIR/tsconfig.json" "$PROD_DIR/" 2>/dev/null || true
  cp "$DEV_DIR/components.json" "$PROD_DIR/" 2>/dev/null || true
fi

# Đảm bảo .env.production hoặc .env.local ở prod
if [ ! -f "$PROD_DIR/.env.production" ] && [ -f "$DEV_DIR/.env.local" ]; then
  cp "$DEV_DIR/.env.local" "$PROD_DIR/.env.production"
fi

cd "$PROD_DIR"

# 3. Cài đặt dependencies (nếu có thay đổi)
echo "==> [3/5] Cài đặt dependencies..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
elif command -v bun >/dev/null 2>&1; then
  bun install
else
  npm install
fi

# 4. Build bản mới (ra .next-new để zero-downtime)
echo "==> [4/5] Build Next.js Production (ra .next-new)..."
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
  echo "❌ LỖI: Build thất bại — GIỮ NGUYÊN bản 3000 đang chạy, không restart!" >&2
  exit 1
fi

# 5. Swap bản build mới và restart
echo "==> [5/5] Swap bản build mới & restart $SERVICE..."
rm -rf .next.old
[ -d .next ] && mv .next .next.old
mv .next-new .next

if systemctl restart "$SERVICE" 2>/dev/null || sudo systemctl restart "$SERVICE" 2>/dev/null; then
  echo "==> Đang kiểm tra trạng thái hoạt động (Health Check)..."
  for i in $(seq 1 30); do
    if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
      rm -rf .next.old
      echo ""
      echo "🎉 THÀNH CÔNG: Đã cập nhật xong phiên bản mới lên cổng 3000!"
      echo "👉 Truy cập: https://minhtanphat.io.vn hoặc http://localhost:3000"
      exit 0
    fi
    sleep 1
  done
fi

echo "⚠️ CẢNH BÁO: Health check không phản hồi — đang Rollback về bản cũ..." >&2
rm -rf .next
[ -d .next.old ] && mv .next.old .next
systemctl restart "$SERVICE" 2>/dev/null || sudo systemctl restart "$SERVICE" 2>/dev/null || true
echo "❌ ĐÃ ROLLBACK về phiên bản trước. Vui lòng kiểm tra log: journalctl -u mtp-web -n 50" >&2
exit 1
