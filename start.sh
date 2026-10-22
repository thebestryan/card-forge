#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9090}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Card Forge starting on http://localhost:$PORT"

# Run each candidate rather than just finding it: on Windows (Git Bash),
# python.exe can be a Microsoft Store placeholder that isn't really Python
PYTHON=""
for candidate in python3 python py; do
  if command -v "$candidate" &>/dev/null && "$candidate" -c 'import sys' &>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done

# Try node first, fall back to python
if command -v node &>/dev/null && [ -f "$DIR/node_modules/.bin/http-server" ]; then
  exec npx http-server "$DIR" -p "$PORT" -c-1 --open
elif [ -n "$PYTHON" ]; then
  echo "Press Ctrl+C to stop"
  cd "$DIR"
  "$PYTHON" -m http.server "$PORT" &
  SERVER_PID=$!
  sleep 1
  if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT" 2>/dev/null &
  elif command -v open &>/dev/null; then
    open "http://localhost:$PORT" 2>/dev/null &
  elif command -v explorer.exe &>/dev/null; then
    # Git Bash / WSL on Windows
    explorer.exe "http://localhost:$PORT" 2>/dev/null &
  fi
  wait $SERVER_PID
else
  echo "Error: No suitable server found. Install python3 or run: npx http-server -p $PORT"
  exit 1
fi
