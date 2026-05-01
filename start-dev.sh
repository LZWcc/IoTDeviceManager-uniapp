#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PIDS=()

cleanup() {
  local exit_code=$?
  trap - INT TERM EXIT

  if [ ${#PIDS[@]} -gt 0 ]; then
    echo "Stopping dev processes..."
    kill "${PIDS[@]}" 2>/dev/null || true
    wait "${PIDS[@]}" 2>/dev/null || true
  fi

  exit "$exit_code"
}

trap cleanup INT TERM EXIT

start_process() {
  local name="$1"
  shift

  echo "Starting ${name}..."
  "$@" &
  local pid=$!
  PIDS+=("$pid")
  echo "${name} pid: ${pid}"
}

wait_for_backend() {
  echo "Waiting for backend at http://127.0.0.1:8081 ..."

  for _ in {1..30}; do
    if node -e "require('http').get('http://127.0.0.1:8081/', res => process.exit(res.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"; then
      echo "Backend is ready."
      return 0
    fi

    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo "Backend exited before it became ready."
      wait "$BACKEND_PID"
      exit 1
    fi

    sleep 1
  done

  echo "Backend did not become ready within 30 seconds."
  exit 1
}

start_process "backend" bash -c 'cd ./backend && node ./src/index.js'
BACKEND_PID=${PIDS[$((${#PIDS[@]} - 1))]}
wait_for_backend

start_process "device simulator" bash -c 'cd ./backend/src/Devices && env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 node simulateDevice.js | grep --line-buffered SYNC_TIME'
start_process "frontend H5" pnpm dev:h5

echo "All dev processes are running. Press Ctrl+C to stop them."

while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid"
      exit $?
    fi
  done
  sleep 1
done
