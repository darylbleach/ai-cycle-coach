#!/bin/bash
# garmin_sync_cron_wrapper.sh
# Wrapper script for the Garmin sync cron job that handles environment setup and error handling

# Set up logging
LOG_FILE="/Users/darylbleach/Sites/ai-coach/logs/garmin_sync_cron.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SYNC_DATE=$(date '+%Y-%m-%d')

# Create logs directory if it doesn't exist
mkdir -p /Users/darylbleach/Sites/ai-coach/logs

# Log function
log() {
  echo "$TIMESTAMP - $1" >> "$LOG_FILE"
  echo "$TIMESTAMP - $1"
}

log "Starting Garmin sync cron job for date $SYNC_DATE"

# Set up environment variables
export PATH="/Users/darylbleach/Sites/ai-coach/garmin-env/bin:$PATH"
export PYTHONPATH="/Users/darylbleach/Sites/ai-coach:$PYTHONPATH"

# Set Garmin token directory
TOKEN_DIR="/Users/darylbleach/Sites/ai-coach/garmin-tokens"

# Change to project directory
cd /Users/darylbleach/Sites/ai-coach || {
  log "ERROR: Could not change to project directory"
  exit 1
}

# Find all Garmin users (based on token files)
if [ -d "$TOKEN_DIR" ]; then
  for token_file in "$TOKEN_DIR"/*.json; do
    if [ -f "$token_file" ]; then
      # Extract email from filename
      filename=$(basename "$token_file")
      email="${filename%.json}"
      
      log "Processing user: $email"
      
      # Run Python script with retry logic
      max_retries=3
      retry=0
      success=false
      
      while [ $retry -lt $max_retries ] && [ "$success" = false ]; do
        log "Attempt $((retry+1)) of $max_retries for user $email"
        
        # Run the sync script
        /Users/darylbleach/Sites/ai-coach/garmin-env/bin/python \
          /Users/darylbleach/Sites/ai-coach/scripts/garmin_sync.py \
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