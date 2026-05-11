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

wait_for_http() {
  local name="$1"
  local url="$2"
  local pid="$3"
  local attempts="${4:-30}"

  echo "Waiting for ${name} at ${url} ..."

  for _ in $(seq 1 "$attempts"); do
    if node -e "const url = process.argv[1]; require('http').get(url, res => process.exit(res.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))" "$url"; then
      echo "${name} is ready."
      return 0
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
      echo "${name} exited before it became ready."
      wait "$pid"
      exit 1
    fi

    sleep 1
  done

  echo "${name} did not become ready within ${attempts} seconds."
  exit 1
}

start_process "frontend H5" pnpm run dev:h5
FRONTEND_PID=${PIDS[$((${#PIDS[@]} - 1))]}
wait_for_http "frontend H5" "http://localhost:5173/" "$FRONTEND_PID" 60

start_process "backend" bash -c 'cd ./backend && node ./src/index.js'
BACKEND_PID=${PIDS[$((${#PIDS[@]} - 1))]}
wait_for_http "backend" "http://127.0.0.1:8081/" "$BACKEND_PID" 30

start_process "device simulator" bash -c 'cd ./backend && env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 node ./src/Devices/simulateDevice.js'

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
