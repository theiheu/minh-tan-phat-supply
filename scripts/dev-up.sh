#!/usr/bin/env bash
# Khởi động môi trường dev local: Supabase + Next.js — chạy 1 lệnh là lên hết.
#
# Vì sao có script này:
#   Trước đây `supabase start` lần đầu hay fail với lỗi
#   "container name ... is already in use" do container Supabase cũ (stopped) còn
#   sót lại từ phiên trước, phải chạy lần 2 mới lên. Script tự dọn các container
#   đã dừng của project TRƯỚC khi start (không đụng stack đang chạy), và nếu
#   start vẫn lỗi (race trong nhánh restore-backup) thì dọn rồi thử lại 1 lần.
#
# Idempotent: nếu Supabase / Next.js đã chạy thì bỏ qua, không start trùng.
#
# Dùng:
#   bun run dev:up          (hoặc)   bash scripts/dev-up.sh
# Biến môi trường tuỳ chọn: SUPABASE_CLI=<đường dẫn binary supabase>
set -euo pipefail

cd "$(dirname "$0")/.."

# --- Cấu hình (đọc từ supabase/config.toml) ---
PROJECT_ID="$(sed -n 's/^project_id *= *"\([^"]*\)".*/\1/p' supabase/config.toml | head -1)"
PROJECT_ID="${PROJECT_ID:-minh-tan-phat-supply}"
API_PORT="$(sed -n 's/^port *= *\([0-9][0-9]*\).*/\1/p' supabase/config.toml | head -1)"
API_PORT="${API_PORT:-54321}"
API_URL="http://127.0.0.1:${API_PORT}"
APP_URL="http://localhost:3001"
STUDIO_URL="http://127.0.0.1:54323"
PID_FILE=".tmp/dev-server.pid"
LOG_FILE=".tmp/dev-server.log"

# --- Tìm binary supabase CLI ---
resolve_cli() {
  if [ -n "${SUPABASE_CLI:-}" ] && [ -x "$SUPABASE_CLI" ]; then printf '%s\n' "$SUPABASE_CLI"; return 0; fi
  if command -v supabase >/dev/null 2>&1; then command -v supabase; return 0; fi
  local c
  for c in "$HOME"/.bun/install/cache/@supabase/cli-linux-x64@*/bin/supabase; do
    [ -x "$c" ] && { printf '%s\n' "$c"; return 0; }
  done
  return 1
}

CLI="$(resolve_cli || true)"
if [ -z "$CLI" ]; then
  echo "Không tìm thấy supabase CLI. Cài bằng: bunx supabase@2.116.0 rồi chạy lại." >&2
  exit 1
fi
echo "Supabase CLI: $CLI"

# --- Dọn container Supabase cũ của project này (chỉ container ĐÃ DỪNG) ---
# Không bao giờ đụng tới container đang chạy -> an toàn khi stack đã up.
cleanup_stale() {
  local c
  while IFS= read -r c; do
    [ -z "$c" ] && continue
    if docker rm -f "$c" >/dev/null 2>&1; then
      echo "  đã xoá container cũ (stopped): $c"
    fi
  done < <(docker ps -a \
      --filter "name=^/supabase_" \
      --filter "status=exited" --filter "status=created" --filter "status=dead" \
      --format '{{.Names}}' 2>/dev/null \
      | grep -E "_${PROJECT_ID}$" || true)
}

api_up() { curl -fsS -m 3 "${API_URL}/auth/v1/health" >/dev/null 2>&1; }
app_up() { curl -fsS -m 3 -o /dev/null "${APP_URL}/login" >/dev/null 2>&1; }

echo "==> Dọn container Supabase cũ (nếu có)..."
cleanup_stale

# --- Supabase ---
if api_up; then
  echo "==> Supabase đã chạy: ${API_URL}"
else
  echo "==> Supabase start (lần 1)..."
  if ! "$CLI" start; then
    echo "==> Start lần 1 lỗi — dọn container cũ và thử lại lần 2..."
    cleanup_stale
    if ! "$CLI" start; then
      echo "LỖI: 'supabase start' vẫn thất bại sau khi thử lại. Xem log phía trên." >&2
      exit 1
    fi
  fi
  echo "==> Supabase OK: ${API_URL}"
fi

# --- Next.js dev server ---
if app_up; then
  echo "==> Next.js đã chạy: ${APP_URL}"
else
  echo "==> Khởi động Next.js dev server (log: ${LOG_FILE})..."
  mkdir -p .tmp
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "LỖI: ${APP_URL} không phản hồi nhưng pid $(cat "$PID_FILE") (ghi trong ${PID_FILE}) vẫn tồn tại — kiểm tra thủ công." >&2
    exit 1
  fi
  rm -f "$PID_FILE"
  nohup bun run dev >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  for _ in $(seq 1 60); do
    app_up && { echo "==> Next.js OK: ${APP_URL}"; break; }
    sleep 1
  done
  if ! app_up; then
    echo "LỖI: Next.js chưa sẵn sàng sau 60s — xem ${LOG_FILE}" >&2
    exit 1
  fi
fi

echo ""
echo "Môi trường dev đã sẵn sàng:"
echo "  App:    ${APP_URL}     (manager@mtp.local / password123)"
echo "  API:    ${API_URL}"
echo "  Studio: ${STUDIO_URL}"
