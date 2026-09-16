#!/bin/bash
# garmin_sync_cron_wrapper.sh
# Wrapper script for the Garmin sync cron job that handles environment setup and error handling

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${PYTHON_PATH:-$PROJECT_ROOT/garmin-env/bin/python}"
TOKEN_DIR="${GARMIN_TOKEN_DIR:-$PROJECT_ROOT/garmin-tokens}"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/garmin_sync_cron.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SYNC_DATE=$(date '+%Y-%m-%d')

mkdir -p "$LOG_DIR"

log() {
  echo "$TIMESTAMP - $1" | tee -a "$LOG_FILE"
}

log "Starting Garmin sync cron job for date $SYNC_DATE"

export PATH="$(dirname "$PYTHON_BIN"):$PATH"
export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

cd "$PROJECT_ROOT" || {
  log "ERROR: Could not change to project directory $PROJECT_ROOT"
  exit 1
}

if [ -d "$TOKEN_DIR" ]; then
  for token_file in "$TOKEN_DIR"/*.json; do
    if [ -f "$token_file" ]; then
      filename=$(basename "$token_file")
      email="${filename%.json}"

      log "Processing user: $email"

      max_retries=3
      retry=0
      success=false

      while [ $retry -lt $max_retries ] && [ "$success" = false ]; do
        log "Attempt $((retry+1)) of $max_retries for user $email"

        "$PYTHON_BIN" \
          "$PROJECT_ROOT/scripts/garmin_sync.py" \
          "$email" "$TOKEN_DIR" "$SYNC_DATE" >> "$LOG_FILE" 2>&1

        exit_code=$?

        if [ $exit_code -eq 0 ]; then
          log "Sync successful for user $email"
          success=true
        else
          log "Sync failed for user $email (exit code: $exit_code)"
          retry=$((retry+1))

          if [ $retry -lt $max_retries ]; then
            sleep_time=$((retry * 60))
            log "Waiting $sleep_time seconds before retry..."
            sleep $sleep_time
          fi
        fi
      done

      if [ "$success" = false ]; then
        log "ERROR: All retry attempts failed for user $email"
      fi
    fi
  done
else
  log "ERROR: Token directory $TOKEN_DIR does not exist"
  exit 1
fi

log "Garmin sync cron job completed"
