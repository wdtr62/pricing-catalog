#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-5173}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is not installed. Install it, then rerun."
  exit 1
fi

URL="http://localhost:${PORT}/"

echo "Starting local server in:"
echo "  $ROOT_DIR"
echo
echo "URL:"
echo "  $URL"
echo
echo "Tip: Press Ctrl+C to stop the server."
echo

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID="$!"

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

sleep 0.25

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v gio >/dev/null 2>&1; then
  gio open "$URL" >/dev/null 2>&1 || true
fi

wait "$SERVER_PID"

