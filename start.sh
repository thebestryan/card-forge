#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9090}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Card Forge starting on http://localhost:$PORT"

# Try node first, fall back to python
if command -v node &>/dev/null && [ -f "$DIR/node_modules/.bin/http-server" ]; then
  exec npx http-server "$DIR" -p "$PORT" -c-1 --open
elif command -v python3 &>/dev/null || command -v python &>/dev/null; then
  PYTHON=$(command -v python3 || command -v python)
  echo "Press Ctrl+C to stop"
  cd "$DIR"
  "$PYTHON" -m http.server "$PORT" &
  SERVER_PID=$!
  sleep 1
  if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT" 2>/dev/null &
  elif command -v open &>/dev/null; then
    open "http://localhost:$PORT" 2>/dev/null &
  fi
  wait $SERVER_PID
else
  echo "Error: No suitable server found. Install python3 or run: npx http-server -p $PORT"
  exit 1
fi
