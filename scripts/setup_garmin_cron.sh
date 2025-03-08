#!/bin/bash
# setup_garmin_cron.sh
# Script to set up the Garmin sync cron job

# Print header
echo "====================================="
echo "Setting up Garmin Sync Cron Job"
echo "====================================="

# Get the absolute path to the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Project directory: $PROJECT_DIR"

# Create the cron job entry
# Run at 5:30 AM daily to ensure Garmin has processed the previous day's data
CRON_JOB="30 5 * * * $PROJECT_DIR/scripts/garmin_sync_cron_wrapper.sh"

# Check if cron job already exists
EXISTING_CRON=$(crontab -l 2>/dev/null | grep -F "$PROJECT_DIR/scripts/garmin_sync_cron_wrapper.sh" || true)

if [ -n "$EXISTING_CRON" ]; then
    echo "Cron job already exists:"
    echo "$EXISTING_CRON"
    echo
    echo "No changes made."
else
    # Add the new cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    
    echo "Cron job added successfully!"
    echo "Job will run at 5:30 AM daily."
    echo
    echo "Current crontab:"
    crontab -l
fi

# Make sure the cron wrapper script is executable
chmod +x "$PROJECT_DIR/scripts/garmin_sync_cron_wrapper.sh"
echo
echo "Made cron wrapper script executable."

# Remind about environment variables
echo
echo "IMPORTANT: Make sure to set the GARMIN_PASSWORD environment variable in your system"
echo "or in the crontab using the following command:"
echo
echo "  env EDITOR=nano crontab -e"
echo
echo "Then add the following line at the top of the crontab:"
echo "  GARMIN_PASSWORD=your_password_here"
echo
echo "This allows the script to automatically refresh tokens when needed."
echo "=====================================" 