#!/usr/bin/env bash
# Dừng môi trường dev local sạch sẽ: tắt Next.js dev server (nếu do dev:up khởi
# động) + supabase stop (GIỮ data local). Kết thúc phiên bằng script này giúp lần
# sau `bun run dev:up` start ngay không gặp container cũ.
#
# Dùng:
#   bun run dev:down        (hoặc)   bash scripts/dev-down.sh
# Xoá luôn data local:      supabase stop --no-backup
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_ID="$(sed -n 's/^project_id *= *"\([^"]*\)".*/\1/p' supabase/config.toml | head -1)"
PROJECT_ID="${PROJECT_ID:-minh-tan-phat-supply}"
PID_FILE=".tmp/dev-server.pid"

# --- Tắt Next.js dev server do dev:up khởi động (nếu có) ---
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    echo "Đã tắt Next.js dev server (pid $PID)."
  else
    echo "Next.js dev server không còn chạy (pid $PID đã thoát)."
  fi
  rm -f "$PID_FILE"
else
  echo "Không có pid file — dev server (nếu chạy) hãy tắt thủ công."
fi

# --- Tìm supabase CLI ---
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
if [ -z "$CLI" ] || ! docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qE "^supabase_.*_${PROJECT_ID}$"; then
  echo "Không có container Supabase nào của project này để dừng."
  exit 0
fi

"$CLI" stop
echo "Supabase đã dừng (data local vẫn giữ)."
