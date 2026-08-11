#!/usr/bin/env bash
# Detached dev-server launcher for the Notelings app.
#
# Why this exists: this repo is developed on Windows (Git Bash), where `tmux`
# is NOT installed — so any terminal launcher that relies on tmux fails to
# create a session. This script boots `npm run dev` in the background with
# nohup, records the PID, and streams output to docs/.dev-server.log (a
# gitignored dotfile, mirroring the docs/.last-machine convention).
#
# Idempotent: `start` is a no-op when the server is already answering on
# http://localhost:3000, so it is safe to call at the top of every session.
#
# Usage:
#   bash scripts/dev-server.sh start    # boot the dev server (no-op if already up)
#   bash scripts/dev-server.sh status   # report up/down + PID + log tail
#   bash scripts/dev-server.sh logs     # tail -f the dev-server log
#   bash scripts/dev-server.sh stop     # stop the dev server (kills the :3000 listener)
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG="$ROOT/docs/.dev-server.log"
PIDFILE="$ROOT/docs/.dev-server.pid"
URL="http://localhost:3000"
PORT=3000

is_up() {
  curl -s -o /dev/null -w '%{http_code}' "$URL" --max-time 3 2>/dev/null | grep -q '^200'
}

# True when ANY process is listening on :PORT, regardless of HTTP response.
port_listening() {
  if uname -s 2>/dev/null | grep -qiE 'mingw|msys|cygwin'; then
    netstat -ano 2>/dev/null | awk '$2 ~ /:'"$PORT"'$/ && $4 == "LISTENING" {found=1} END {exit !found}'
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -q ":$PORT "
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
  else
    netstat -an 2>/dev/null | grep -q ":$PORT .*LISTEN"
  fi
}

cmd_start() {
  if is_up; then
    echo "✓ Dev server already running at $URL (HTTP 200). Nothing to do."
    return 0
  fi
  if port_listening; then
    echo "⚠ Port $PORT is occupied by another listener that is not answering HTTP 200."
    echo "  Free it first: bash scripts/dev-server.sh stop (or stop the other app)."
    return 1
  fi

  echo "Starting dev server (nohup, detached)..."
  cd "$ROOT" || exit 1
  : > "$LOG"
  nohup npm run dev > "$LOG" 2>&1 &
  echo "$!" > "$PIDFILE"

  # Wait up to ~30s for Next.js to compile and start answering.
  for _ in $(seq 1 60); do
    if is_up; then
      echo "✓ Ready at $URL"
      tail -5 "$LOG"
      return 0
    fi
    if ! kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
      echo "✗ Dev server exited early — see $LOG"
      tail -20 "$LOG"
      return 1
    fi
    sleep 0.5
  done

  echo "⚠ Not ready after 30s — see $LOG"
  tail -20 "$LOG"
  return 1
}

cmd_status() {
  if is_up; then
    echo "✓ Dev server is UP at $URL"
  else
    echo "✗ Dev server is DOWN on port $PORT"
  fi
  [ -f "$PIDFILE" ] && echo "Recorded PID: $(cat "$PIDFILE")"
  echo "Log: $LOG"
  if [ -f "$LOG" ]; then
    echo "--- last 10 lines ---"
    tail -10 "$LOG"
  fi
}

cmd_logs() {
  if [ ! -f "$LOG" ]; then
    echo "No log file yet — start the server first: bash scripts/dev-server.sh start" >&2
    return 1
  fi
  tail -f "$LOG"
}

cmd_stop() {
  if is_up || port_listening; then
    if uname -s 2>/dev/null | grep -qiE 'mingw|msys|cygwin'; then
      # Windows: netstat exposes the native PID(s) owning :3000; taskkill each.
      NATIVE_PIDS="$(netstat -ano 2>/dev/null | awk '$2 ~ /:'"$PORT"'$/ && $4 == "LISTENING" {print $5}' | sort -u)"
      if [ -z "$NATIVE_PIDS" ]; then
        echo "⚠ Could not find the :$PORT listener — nothing killed." >&2
        return 1
      fi
      STOPPED=0
      for PID in $NATIVE_PIDS; do
        if taskkill //F //PID "$PID" >/dev/null 2>&1; then
          echo "✓ Stopped dev server (native PID $PID)."
          STOPPED=1
        else
          echo "⚠ Failed to kill PID $PID (taskkill errored)." >&2
        fi
      done
      [ "$STOPPED" -eq 1 ] || return 1
    else
      # Unix: stop the recorded npm PID, then sweep for stragglers.
      [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null || true
      pkill -f 'next dev' 2>/dev/null || true
      echo "✓ Stopped dev server."
    fi
  else
    echo "No dev server detected on port $PORT."
  fi
  rm -f "$PIDFILE"
}

case "${1:-}" in
  start) cmd_start ;;
  status) cmd_status ;;
  logs) cmd_logs ;;
  stop) cmd_stop ;;
  *)
    echo "Usage: bash scripts/dev-server.sh {start|status|logs|stop}" >&2
    exit 1
    ;;
esac
