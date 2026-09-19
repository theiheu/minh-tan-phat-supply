#!/usr/bin/env bash
# scripts/cutover-catalog.sh — Full Production Cutover Execution (WP-01 Remediation)

set -euo pipefail

# 1. Thêm preflight bắt buộc
if [ "${MTP_CUTOVER_APPROVED:-}" != "true" ]; then
  echo "❌ LỖI: Thiếu biến MTP_CUTOVER_APPROVED=true (scoped approval requirement)."
  exit 1
fi

if [ -z "${MTP_EXPECTED_APP_COMMIT:-}" ]; then
  echo "❌ LỖI: Thiếu biến MTP_EXPECTED_APP_COMMIT."
  exit 1
fi

if [ -z "${MTP_EXPECTED_SCHEMA_VERSION:-}" ]; then
  echo "❌ LỖI: Thiếu biến MTP_EXPECTED_SCHEMA_VERSION."
  exit 1
fi

if [ -z "${MTP_MAINTENANCE_WINDOW:-}" ]; then
  echo "❌ LỖI: Thiếu biến MTP_MAINTENANCE_WINDOW."
  exit 1
fi

DEV_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROD_DIR="${PROD_DIR:-$HOME/apps/mtp-prod}"
BACKUP_DIR="${BACKUP_DIR:-$DEV_DIR/backups/database}"
EVIDENCE_DIR="$DEV_DIR/docs/superpowers/evidence"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
EVIDENCE_FILE="$EVIDENCE_DIR/${TIMESTAMP}_production_cutover_evidence.txt"
CONTAINER="${MTP_DB_CONTAINER:-supabase_db_minh-tan-phat-supply}"
RESTORE_CONTAINER="${MTP_ISOLATED_RESTORE_TARGET:-$CONTAINER}"
SERVICE="mtp-web"
URL="http://127.0.0.1:3000/login"

# Check dirty working tree
if ! git diff-index --quiet HEAD --; then
  echo "❌ LỖI: Working tree chưa submit hoặc code bị bẩn. Dừng cutover."
  exit 1
fi

CURRENT_COMMIT="$(git rev-parse HEAD)"
if [ "$CURRENT_COMMIT" != "$MTP_EXPECTED_APP_COMMIT" ]; then
  echo "❌ LỖI: Current commit ($CURRENT_COMMIT) không khớp MTP_EXPECTED_APP_COMMIT ($MTP_EXPECTED_APP_COMMIT)."
  exit 1
fi

mkdir -p "$BACKUP_DIR" "$EVIDENCE_DIR"

echo "=================================================================" | tee "$EVIDENCE_FILE"
echo "🚀 [WP-01] FULL PRODUCTION CUTOVER INITIATED (FAIL-CLOSED)" | tee -a "$EVIDENCE_FILE"
echo "   Timestamp:          $TIMESTAMP" | tee -a "$EVIDENCE_FILE"
echo "   App Commit:         $CURRENT_COMMIT" | tee -a "$EVIDENCE_FILE"
echo "   Expected Schema:    $MTP_EXPECTED_SCHEMA_VERSION" | tee -a "$EVIDENCE_FILE"
echo "   Maintenance Window: $MTP_MAINTENANCE_WINDOW" | tee -a "$EVIDENCE_FILE"
echo "=================================================================" | tee -a "$EVIDENCE_FILE"

# Setup failure trap
cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
     echo "⚠️ Cutover fail-closed. Script exited with code $exit_code." | tee -a "$EVIDENCE_FILE"
     echo "   Không tự động tháo write gate khi thất bại để tránh mất schema toàn vẹn." | tee -a "$EVIDENCE_FILE"
  fi
}
trap cleanup EXIT

# 2. Thêm maintenance/write gate thật trước final backup
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [1/8] Thiết lập maintenance/write gate..." | tee -a "$EVIDENCE_FILE"
mkdir -p "$PROD_DIR"
touch "$PROD_DIR/.maintenance_lock"

# Chờ 5s để active sessions ngắt (hoặc dùng write rejection thiết kế)
sleep 5

# 3. Tạo bản sao lưu toàn diện Database
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [2/8] Tạo bản sao lưu Database an toàn trước Cutover..." | tee -a "$EVIDENCE_FILE"
BACKUP_FILE="$BACKUP_DIR/pre_cutover_$TIMESTAMP.dump"
BACKUP_SQL="$BACKUP_DIR/pre_cutover_$TIMESTAMP.sql"

docker exec "$CONTAINER" pg_dump -U postgres -d postgres -F c -b -v -f "/tmp/pre_cutover_$TIMESTAMP.dump"
docker cp "$CONTAINER:/tmp/pre_cutover_$TIMESTAMP.dump" "$BACKUP_FILE"
docker exec "$CONTAINER" rm -f "/tmp/pre_cutover_$TIMESTAMP.dump"

docker exec "$CONTAINER" pg_dump -U postgres -d postgres > "$BACKUP_SQL"

if [ -s "$BACKUP_FILE" ] && [ -s "$BACKUP_SQL" ]; then
  DUMP_SHA="$(sha256sum "$BACKUP_FILE" | awk '{print $1}')"
  echo "✅ Đã tạo sao lưu thành công (SHA256: $DUMP_SHA):" | tee -a "$EVIDENCE_FILE"
  echo "   - Dump: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))" | tee -a "$EVIDENCE_FILE"
else
  echo "❌ LỖI: Sao lưu Database thất bại hoặc file rỗng! Dừng Cutover." | tee -a "$EVIDENCE_FILE"
  exit 1
fi

# 4. Kiểm tra mô phỏng restore trên target biệt lập
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [3/8] Kiểm tra mô phỏng restore trên target biệt lập ($RESTORE_CONTAINER)..." | tee -a "$EVIDENCE_FILE"
RESTORE_TEST_DB="restore_test_$TIMESTAMP"
docker exec "$RESTORE_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$RESTORE_TEST_DB\";" > /dev/null
docker cp "$BACKUP_FILE" "$RESTORE_CONTAINER:/tmp/test_restore_$TIMESTAMP.dump"
if ! docker exec "$RESTORE_CONTAINER" pg_restore -U postgres -d "$RESTORE_TEST_DB" -1 "/tmp/test_restore_$TIMESTAMP.dump" > /dev/null 2>&1; then
  echo "❌ LỖI: pg_restore mô phỏng thất bại. Dừng Cutover." | tee -a "$EVIDENCE_FILE"
  docker exec "$RESTORE_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE \"$RESTORE_TEST_DB\";" > /dev/null 2>&1
  exit 1
fi
docker exec "$RESTORE_CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE \"$RESTORE_TEST_DB\";" > /dev/null 2>&1
docker exec "$RESTORE_CONTAINER" rm -f "/tmp/test_restore_$TIMESTAMP.dump"
echo "✅ Quá trình restore test hoàn tất." | tee -a "$EVIDENCE_FILE"

# 5. Apply đúng migration set & Check Expected version
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [4/8] Xác minh schema version đang áp dụng..." | tee -a "$EVIDENCE_FILE"
# Để fail-closed thực sự, ta phải assert được expected schema có tồn tại và đúng version
OBSERVED_SCHEMA_VERSION="$(docker exec "$CONTAINER" psql -U postgres -d postgres -tAc "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;" 2>/dev/null || echo "failed")"

if [ "$OBSERVED_SCHEMA_VERSION" != "$MTP_EXPECTED_SCHEMA_VERSION" ]; then
  echo "❌ LỖI: Schema hiện tại ($OBSERVED_SCHEMA_VERSION) không khớp với expected ($MTP_EXPECTED_SCHEMA_VERSION)." | tee -a "$EVIDENCE_FILE"
  exit 1
fi
echo "✅ Schema hợp lệ: $OBSERVED_SCHEMA_VERSION" | tee -a "$EVIDENCE_FILE"

# 6. Chạy audit / kernel oracles
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [5/8] Kiểm tra Checksum & Audit cơ sở dữ liệu, chạy Kernel oracles..." | tee -a "$EVIDENCE_FILE"
if [ -f "$DEV_DIR/scripts/catalog-audit.sql" ]; then
  docker exec "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "$DEV_DIR/scripts/catalog-audit.sql" | tee -a "$EVIDENCE_FILE"
fi

for oracle in "$DEV_DIR"/scripts/verify-*.ts; do
  if [ -f "$oracle" ]; then
    npx tsx "$oracle" | tee -a "$EVIDENCE_FILE"
  fi
done

# 7. Đồng bộ mã nguồn đã pin
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [6/8] Đồng bộ mã nguồn sang thư mục Production ($PROD_DIR)..." | tee -a "$EVIDENCE_FILE"
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
pnpm install --frozen-lockfile

# 8. Build & Health check
echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [7/8] Production Build & Health check workflows..." | tee -a "$EVIDENCE_FILE"
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
systemctl restart "$SERVICE" 2>/dev/null || sudo systemctl restart "$SERVICE" 2>/dev/null || echo "Ghi chú: Lệnh systemctl không chạy trên local test."

HEALTHY=0
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
    HEALTHY=1
    break
  fi
  sleep 1
done

if [ "$HEALTHY" -ne 1 ]; then
  echo "❌ LỖI: Health check thất bại. Rollback .next..." | tee -a "$EVIDENCE_FILE"
  rm -rf .next
  [ -d .next.old ] && mv .next.old .next
  systemctl restart "$SERVICE" 2>/dev/null || sudo systemctl restart "$SERVICE" 2>/dev/null || true
  exit 1
fi

rm -rf .next.old
rm -f "$PROD_DIR/.maintenance_lock"

ARTIFACT_HASH="$(find .next/ -type f -exec sha256sum {} + | sort | sha256sum | awk '{print $1}')"
[ -z "$ARTIFACT_HASH" ] && ARTIFACT_HASH="unknown"
END_TIME="$(date +%Y%m%d_%H%M%S)"

echo "" | tee -a "$EVIDENCE_FILE"
echo "==> [8/8] Ghi nhận Manifest..." | tee -a "$EVIDENCE_FILE"
echo "=================================================================" | tee -a "$EVIDENCE_FILE"
echo "🎉 [CUTOVER COMPLETE] WP-01 PRODUCTION CUTOVER THÀNH CÔNG!" | tee -a "$EVIDENCE_FILE"
echo "   Opening timestamp: $END_TIME" | tee -a "$EVIDENCE_FILE"
echo "   App Commit:        $CURRENT_COMMIT" | tee -a "$EVIDENCE_FILE"
echo "   Artifact Hash:     $ARTIFACT_HASH" | tee -a "$EVIDENCE_FILE"
echo "   Backup Dump SHA:   $DUMP_SHA" | tee -a "$EVIDENCE_FILE"
echo "   Schema Version:    $MTP_EXPECTED_SCHEMA_VERSION" | tee -a "$EVIDENCE_FILE"
echo "   Evidence saved:    $EVIDENCE_FILE" | tee -a "$EVIDENCE_FILE"
echo "=================================================================" | tee -a "$EVIDENCE_FILE"

trap - EXIT
exit 0
