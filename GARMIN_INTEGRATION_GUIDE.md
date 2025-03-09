# Garmin Connect Integration Guide

This guide explains how to set up, use, and troubleshoot the Garmin Connect integration in the AI Cycle Coach application.

## Table of Contents

1. [Setup](#setup)
2. [Connecting Garmin Accounts](#connecting-garmin-accounts)
3. [Syncing Health Data](#syncing-health-data)
4. [Uploading Workouts to Garmin](#uploading-workouts-to-garmin)
5. [Daily Sync Functionality](#daily-sync-functionality)
6. [Troubleshooting](#troubleshooting)
7. [Testing Tools](#testing-tools)

## Setup

Before using the Garmin integration, ensure that you have:

1. **Python Environment**: A Python virtual environment with the required packages
2. **Token Directory**: A directory to store Garmin authentication tokens
3. **Environment Variables**: Properly configured environment variables

### Setting Up the Python Environment

```bash
# Create a Python virtual environment
python3 -m venv garmin-env

# Activate the virtual environment
# On macOS/Linux:
source garmin-env/bin/activate
# On Windows:
# garmin-env\Scripts\activate

# Install the required packages
pip install garminconnect garth
```

### Creating the Token Directory

```bash
mkdir -p garmin-tokens
chmod 755 garmin-tokens
```

### Environment Variables

Add the following to your `.env.local` file:

```
# Python Path Configuration
PYTHON_PATH="${PWD}/garmin-env/bin/python"

# Garmin Configuration
GARMIN_TOKEN_DIR="${PWD}/garmin-tokens"
USE_SAMPLE_DATA=false

# API Keys
CRON_API_KEY="your_secure_cron_api_key"
INTERNAL_API_KEY="your_secure_internal_api_key"
```

## Connecting Garmin Accounts

Users can connect their Garmin accounts through the Settings page in the application. The connection process:

1. User enters their Garmin Connect email and password
2. The system authenticates with Garmin Connect
3. Authentication tokens are stored for future use

> **Important Security Note**: Garmin passwords are never stored. Only the authentication tokens are saved.

## Syncing Health Data

Once connected, a user's health data can be synced in two ways:

1. **Manually**: By clicking the "Sync with Garmin" button on the Dashboard
2. **Automatically**: Through the daily sync process that runs automatically

### Health Metrics Synced

- Sleep duration and quality
- Resting heart rate
- Heart rate variability (HRV)
- Stress levels
- Body battery
- VO2 Max (when available)
- Training readiness (calculated based on other metrics)

## Uploading Workouts to Garmin

Workouts created in the AI Cycle Coach can be sent to Garmin Connect with the following steps:

1. Navigate to a workout in your training plan
2. Click "Send to Garmin"
3. The workout will be uploaded to your Garmin Connect account
4. Access it in Garmin Connect to execute on your device

### Workout Format

The application creates structured workouts that can be followed on Garmin devices. These include:

- Warm-up, work intervals, recovery, and cool-down phases
- Power targets (for cycling) or pace/heart rate targets (for running)
- Step-by-step instructions

## Daily Sync Functionality

The system includes a daily sync process that:

1. Runs automatically each morning
2. Syncs health data for all users with connected Garmin accounts
3. Adjusts scheduled workouts based on training readiness

### How Workout Adjustment Works

If a user's training readiness score is below threshold values, workouts may be:
- Decreased in intensity
- Shortened in duration
- Changed to recovery workouts
- Rescheduled (in extreme cases)

## Troubleshooting

### Authentication Issues

If you encounter authentication issues:

1. Try reconnecting your Garmin account in the Settings page
2. Ensure your Garmin password is correct
3. Check if Multi-Factor Authentication (MFA) is enabled on your Garmin account (it needs to be temporarily disabled for connection)

### Session Errors

If you see JWE decryption errors or authentication issues:

1. Clear your browser storage and cookies by running the provided script in your browser console:
   ```javascript
   // See scripts/clear-session-storage.js
   ```
2. Refresh the page and log in again

### Missing Health Data

If health data is not appearing:

1. Ensure your Garmin device is synced with Garmin Connect
2. Check if the data exists in your Garmin Connect account
3. Try manual sync from the Dashboard
4. Verify your Garmin account is still connected in Settings

### Workout Upload Failures

If workouts fail to upload to Garmin:

1. Check if your Garmin account is still connected
2. Reconnect your Garmin account if necessary
3. Ensure the workout is properly structured
4. Try again later (Garmin API has rate limits)

## Testing Tools

The repository includes several tools for testing Garmin integration:

### Test Garmin Upload

This script tests uploading a workout to Garmin Connect:

```bash
node scripts/test-garmin-upload.js <garmin-email>
```

### Test Daily Sync

This script tests the daily sync cron job:

```bash
node scripts/test-daily-sync.js
```

### Manual Database Initialization

If you need to re-create database tables:

```bash
./scripts/manual-db-init.sh
```

## Additional Resources

- [Garmin Connect Web API Documentation](https://connect.garmin.com/display/ManualsDev)
- [garminconnect Python Library](https://github.com/cyberjunky/python-garminconnect)
- [Garmin Device Compatibility](https://support.garmin.com/en-US) 