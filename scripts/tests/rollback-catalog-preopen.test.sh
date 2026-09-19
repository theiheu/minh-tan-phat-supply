#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "🛠 Chạy tests cho rollback-catalog-preopen.sh"
echo "========================================="

# Tạo thư mục test
TEST_DIR=$(mktemp -d)
trap 'rm -rf "$TEST_DIR"' EXIT

# Mock các thư mục và lệnh
export BACKUP_DIR="$TEST_DIR/backups"
export PROD_DIR="$TEST_DIR/prod"
mkdir -p "$BACKUP_DIR"
touch "$BACKUP_DIR/pre_cutover_test.dump"

mkdir -p "$TEST_DIR/bin"
export PATH="$TEST_DIR/bin:$PATH"

# Tạo mock docker
cat << 'EOF' > "$TEST_DIR/bin/docker"
#!/usr/bin/env bash
if [[ "$*" == *"pg_restore"* ]]; then
  if [[ "$MOCK_RESTORE_FAIL" == "1" ]]; then
    echo "pg_restore mocked failure" >&2
    exit 1
  fi
  exit 0
fi
exit 0
EOF
chmod +x "$TEST_DIR/bin/docker"

# Tạo mock systemctl
cat << 'EOF' > "$TEST_DIR/bin/systemctl"
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$TEST_DIR/bin/systemctl"

# Tạo mock curl
cat << 'EOF' > "$TEST_DIR/bin/curl"
#!/usr/bin/env bash
if [[ "$*" == *"/login"* ]]; then
  exit 0
fi
exit 0
EOF
chmod +x "$TEST_DIR/bin/curl"

# Tạo mock npx
cat << 'EOF' > "$TEST_DIR/bin/npx"
#!/usr/bin/env bash
if [[ "$*" == *"tsx scripts/verify-restored-catalog-state.ts"* ]]; then
  if [[ "$MOCK_VERIFY_FAIL" == "1" ]]; then
    echo "verify restored state mocked failure" >&2
    exit 1
  fi
  exit 0
fi
# Dịch qua môi trường thực nếu không phải lệnh đang test (cẩn thận recursion nếu bị trỏ lại npx fake)
exit 0
EOF
chmod +x "$TEST_DIR/bin/npx"

# 1. Test Restore Failure
echo "--- Test 1: Restore Failure (pg_restore fail)"
export MOCK_RESTORE_FAIL=1
export MOCK_VERIFY_FAIL=0

set +e
bash scripts/rollback-catalog-preopen.sh "$BACKUP_DIR/pre_cutover_test.dump" > "$TEST_DIR/out1.log" 2>&1
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -ne 0 ]] && grep -q "pg_restore trả về non-zero exit code" "$TEST_DIR/out1.log"; then
  echo "✅ Test 1 Passed"
else
  echo "❌ Test 1 Failed"
  cat "$TEST_DIR/out1.log"
  exit 1
fi

# 2. Test Invariant Failure
echo "--- Test 2: Invariant Failure (verify script fail)"
export MOCK_RESTORE_FAIL=0
export MOCK_VERIFY_FAIL=1

set +e
bash scripts/rollback-catalog-preopen.sh "$BACKUP_DIR/pre_cutover_test.dump" > "$TEST_DIR/out2.log" 2>&1
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -ne 0 ]] && grep -q "Cơ sở dữ liệu sau phục hồi không vẹn toàn" "$TEST_DIR/out2.log"; then
  echo "✅ Test 2 Passed"
else
  echo "❌ Test 2 Failed"
  cat "$TEST_DIR/out2.log"
  exit 1
fi

# 3. Test Success
echo "--- Test 3: Success Path"
export MOCK_RESTORE_FAIL=0
export MOCK_VERIFY_FAIL=0

set +e
bash scripts/rollback-catalog-preopen.sh "$BACKUP_DIR/pre_cutover_test.dump" > "$TEST_DIR/out3.log" 2>&1
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -eq 0 ]] && grep -q "ROLLBACK THÀNH CÔNG" "$TEST_DIR/out3.log"; then
  echo "✅ Test 3 Passed"
else
  echo "❌ Test 3 Failed"
  cat "$TEST_DIR/out3.log"
  exit 1
fi

echo "🎉 Mọi bài test DB Restore/Rollback pre-open đều pass!"
