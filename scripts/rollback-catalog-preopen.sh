#!/usr/bin/env bash
# scripts/rollback-catalog-preopen.sh — Pre-open Cutover Rollback Utility
#
# Usage:
#   bash scripts/rollback-catalog-preopen.sh [backup_dump_file]

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$DEV_DIR/backups/database}"
PROD_DIR="${PROD_DIR:-$HOME/apps/mtp-prod}"
CONTAINER="supabase_db_minh-tan-phat-supply"
SERVICE="mtp-web"
URL="http://127.0.0.1:3000/login"

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  # Lấy bản backup mới nhất
  BACKUP_FILE="$(ls -t "$BACKUP_DIR"/pre_cutover_*.dump 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Lỗi: Không tìm thấy file backup dump để rollback!" >&2
  echo "   Vui lòng chỉ định đường dẫn: bash scripts/rollback-catalog-preopen.sh <path_to_dump>" >&2
  exit 1
fi

echo "================================================================="
echo "⏪ BẮT ĐẦU ROLLBACK PRE-OPEN CUTOVER"
echo "   Sử dụng bản backup: $BACKUP_FILE"
echo "================================================================="

# 1. Dừng service web tạm thời
echo "==> [1/4] Dừng service $SERVICE..."
systemctl stop "$SERVICE" 2>/dev/null || sudo systemctl stop "$SERVICE" 2>/dev/null || true

# 2. Phục hồi cơ sở dữ liệu
echo "==> [2/4] Phục hồi cơ sở dữ liệu từ $BACKUP_FILE..."
docker cp "$BACKUP_FILE" "$CONTAINER:/tmp/restore.dump"
docker exec "$CONTAINER" pg_restore -U postgres -d postgres -c --if-exists -v "/tmp/restore.dump" || true
docker exec "$CONTAINER" rm -f "/tmp/restore.dump"

# 3. Khôi phục build .next.old nếu có
echo "==> [3/4] Khôi phục phiên bản web build trước đó..."
if [ -d "$PROD_DIR/.next.old" ]; then
  rm -rf "$PROD_DIR/.next"
  mv "$PROD_DIR/.next.old" "$PROD_DIR/.next"
fi

# 4. Khởi động lại service và kiểm tra
echo "==> [4/4] Khởi động lại $SERVICE & Health check..."
systemctl start "$SERVICE" 2>/dev/null || sudo systemctl start "$SERVICE" 2>/dev/null

for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
    echo ""
    echo "🎉 ROLLBACK THÀNH CÔNG: Hệ thống đã khôi phục trạng thái trước cutover!"
    echo "👉 Truy cập: http://localhost:3000"
    exit 0
  fi
  sleep 1
done

echo "❌ CẢNH BÁO: Service chưa phản hồi sau khi rollback. Vui lòng kiểm tra log: journalctl -u $SERVICE" >&2
exit 1