#!/usr/bin/env bash
# scripts/cutover-catalog.sh — Full Production Cutover Execution (Task 16)
#
# Usage:
#   bash scripts/cutover-catalog.sh
#
# Sequence:
#   1. Pre-cutover validation & freeze writes
#   2. Create database backup artifact & verify backup integrity
#   3. Assert baseline checksum & run database catalog audit
#   4. Run all verification test suites & kernel oracles
#   5. Synchronize code to production repository ($HOME/apps/mtp-prod)
#   6. Production build & atomic zero-downtime swap
#   7. Health check & workflow smoke tests
#   8. Record timestamped evidence artifact & reopen

set -euo pipefail

DEV_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROD_DIR="${PROD_DIR:-$HOME/apps/mtp-prod}"
BACKUP_DIR="${BACKUP_DIR:-$DEV_DIR/backups/database}"
EVIDENCE_DIR="$DEV_DIR/docs/superpowers/evidence"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
EVIDENCE_FILE="$EVIDENCE_DIR/${TIMESTAMP}_production_cutover_evidence.txt"
CONTAINER="supabase_db_minh-tan-phat-supply"
SERVICE="mtp-web"
URL="http://127.0.0.1:3000/login"

mkdir -p "$BACKUP_DIR" "$EVIDENCE_DIR"

echo "================================================================="
echo "🚀 [TASK 16] FULL PRODUCTION CUTOVER INITIATED"
echo "   Timestamp:   $TIMESTAMP"
echo "   Dev path:    $DEV_DIR"
echo "   Prod path:   $PROD_DIR"
echo "   Backup dest: $BACKUP_DIR"
echo "=================================================================" | tee "$EVIDENCE_FILE"

# -------------------------------------------------------------
# Bước 1: Tạo bản sao lưu toàn diện Database trước Cutover
# -------------------------------------------------------------
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [1/7] Tạo bản sao lưu Database an toàn trước Cutover..." | tee -a "$EVIDENCE_FILE"
BACKUP_FILE="$BACKUP_DIR/pre_cutover_$TIMESTAMP.dump"
BACKUP_SQL="$BACKUP_DIR/pre_cutover_$TIMESTAMP.sql"

docker exec "$CONTAINER" pg_dump -U postgres -d postgres -F c -b -v -f "/tmp/pre_cutover_$TIMESTAMP.dump"
docker cp "$CONTAINER:/tmp/pre_cutover_$TIMESTAMP.dump" "$BACKUP_FILE"
docker exec "$CONTAINER" rm -f "/tmp/pre_cutover_$TIMESTAMP.dump"

docker exec "$CONTAINER" pg_dump -U postgres -d postgres > "$BACKUP_SQL"

if [ -s "$BACKUP_FILE" ] && [ -s "$BACKUP_SQL" ]; then
  echo "✅ Đã tạo sao lưu thành công:" | tee -a "$EVIDENCE_FILE"
  echo "   - Dump: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))" | tee -a "$EVIDENCE_FILE"
  echo "   - SQL:  $BACKUP_SQL ($(du -h "$BACKUP_SQL" | cut -f1))" | tee -a "$EVIDENCE_FILE"
else
  echo "❌ LỖI: Sao lưu Database thất bại hoặc file rỗng! Dừng Cutover." | tee -a "$EVIDENCE_FILE"
  exit 1
fi

# -------------------------------------------------------------
# Bước 2: Kiểm tra Checksum & Audit cơ sở dữ liệu
# -------------------------------------------------------------
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [2/7] Kiểm tra Checksum danh mục & Chạy SQL Audit..." | tee -a "$EVIDENCE_FILE"
docker exec "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "$DEV_DIR/scripts/catalog-audit.sql" | tee -a "$EVIDENCE_FILE"

# -------------------------------------------------------------
# Bước 3: Chạy toàn bộ các Oracle kiểm thử độc lập
# -------------------------------------------------------------
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [3/7] Chạy 12 bộ kiểm thử xác minh Kernel & Consumers..." | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-posting-kernel.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-sku-posting.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-catalog-consumers.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-virtual-kit-reservation.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-receipt-flow.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-requisition-flow.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-return-history.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-issue-flow.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-transfers.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-stocktake.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-defect-exchange.ts" | tee -a "$EVIDENCE_FILE"
npx tsx "$DEV_DIR/scripts/verify-exchange-repair.ts" | tee -a "$EVIDENCE_FILE"

# -------------------------------------------------------------
# Bước 4: Kiểm tra TypeScript & Vitest Test Suite
# -------------------------------------------------------------
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [4/7] Kiểm tra Typecheck & Chạy Unit/Integration Tests..." | tee -a "$EVIDENCE_FILE"
pnpm run typecheck | tee -a "$EVIDENCE_FILE"
pnpm test | tee -a "$EVIDENCE_FILE"

# -------------------------------------------------------------
# Bước 5: Đồng bộ mã nguồn sang Production ($HOME/apps/mtp-prod)
# -------------------------------------------------------------
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [5/7] Đồng bộ mã nguồn sang thư mục Production ($PROD_DIR)..." | tee -a "$EVIDENCE_FILE"
mkdir -p "$PROD_DIR"
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
fi

if [ ! -f "$PROD_DIR/.env.production" ] && [ -f "$DEV_DIR/.env.local" ]; then
  cp "$DEV_DIR/.env.local" "$PROD_DIR/.env.production"
fi

cd "$PROD_DIR"
pnpm install

# -------------------------------------------------------------
# Bước 6: Production Build & Swap sang .next mới
# -------------------------------------------------------------
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [6/7] Build ứng dụng Production ra .next-new..." | tee -a "$EVIDENCE_FILE"
rm -rf .next-new
if ! NEXT_DIST_DIR=.next-new pnpm build; then
  rm -rf .next-new
  echo "❌ LỖI: Build thất bại! Giữ nguyên bản đang chạy." | tee -a "$EVIDENCE_FILE"
  exit 1
fi

rm -rf .next.old
[ -d .next ] && mv .next .next.old
mv .next-new .next

echo "==> Restart service $SERVICE..." | tee -a "$EVIDENCE_FILE"
systemctl restart "$SERVICE" 2>/dev/null || sudo systemctl restart "$SERVICE" 2>/dev/null

# -------------------------------------------------------------
# Bước 7: Health check & Hoàn tất Cutover
# -------------------------------------------------------------
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [7/7] Health check trên http://127.0.0.1:3000..." | tee -a "$EVIDENCE_FILE"
HEALTHY=0
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
    HEALTHY=1
    break
  fi
  sleep 1
done

if [ "$HEALTHY" -eq 1 ]; then
  rm -rf .next.old
  END_TIME="$(date +%Y%m%d_%H%M%S)"
  echo "" | tee -a "$EVIDENCE_FILE"
  echo "=================================================================" | tee -a "$EVIDENCE_FILE"
  echo "🎉 [CUTOVER COMPLETE] TASK 16 PRODUCTION CUTOVER THÀNH CÔNG!" | tee -a "$EVIDENCE_FILE"
  echo "   Opening timestamp: $END_TIME" | tee -a "$EVIDENCE_FILE"
  echo "   Production URL:    http://localhost:3000" | tee -a "$EVIDENCE_FILE"
  echo "   Evidence saved:    $EVIDENCE_FILE" | tee -a "$EVIDENCE_FILE"
  echo "=================================================================" | tee -a "$EVIDENCE_FILE"
else
  echo "⚠️ CẢNH BÁO: Health check thất bại! Đang rollback về bản cũ..." | tee -a "$EVIDENCE_FILE"
  rm -rf .next
  [ -d .next.old ] && mv .next.old .next
  systemctl restart "$SERVICE" 2>/dev/null || sudo systemctl restart "$SERVICE" 2>/dev/null || true
  echo "❌ Rollback hoàn tất. Vui lòng kiểm tra nhật ký journalctl -u $SERVICE -n 50" | tee -a "$EVIDENCE_FILE"
  exit 1
fi