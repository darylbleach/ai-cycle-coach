# Garmin Connect Integration Setup

This document explains how to set up the Garmin Connect integration for the AI Cycling Coach application.

## Prerequisites

- Python 3.8 or higher
- pip (Python package installer)
- A Garmin Connect account
- Node.js 16 or higher

## Step 1: Set up the Python virtual environment

The application uses a Python virtual environment to manage dependencies for the Garmin Connect API integration. To set up the virtual environment:

```bash
# Create a Python virtual environment
python3 -m venv garmin-env

# Activate the virtual environment
# On macOS/Linux:
source garmin-env/bin/activate
# On Windows:
# garmin-env\Scripts\activate

# Install the required packages
pip install garminconnect
```

## Step 2: Create the token directory

The application stores Garmin Connect authentication tokens in a directory. Create this directory:

```bash
mkdir -p garmin-tokens
```

## Step 3: Configure environment variables

Add the following environment variables to your `.env.local` file:

```
# Garmin Integration
CRON_API_KEY=your-secure-api-key-here
```

Replace `your-secure-api-key-here` with a secure random string. This key is used to authenticate requests to the cron job API endpoint.

## Step 4: Testing the Integration

### Test Authentication

To test the Garmin Connect authentication, use your Garmin Connect credentials:

1. Navigate to the Settings page in the AI Cycling Coach application
2. Scroll to the "Garmin Connect Integration" section
3. Enter your Garmin Connect username and password
4. Click "Connect to Garmin"

If the connection is successful, you'll see a confirmation message.

### Test Data Sync

After connecting your Garmin account, you can sync your health data:

1. Navigate to the Dashboard page
2. Click the "Sync Garmin Data" button
3. Check the health metrics section to see your synced data

## Troubleshooting

### Authentication Issues

If you encounter authentication issues:

1. Ensure your Garmin Connect credentials are correct
2. Check the server logs for detailed error messages
3. Verify that the Python virtual environment is correctly set up
4. Confirm that the `garmin-tokens` directory exists and is writable

### Sync Issues

If data synchronization fails:

1. Check the server logs for detailed error messages
2. Verify that your Garmin Connect account has the health data you're trying to sync
3. Ensure the Python virtual environment is correctly activated
4. Try manually running the sync script:

```bash
# Activate the virtual environment
source garmin-env/bin/activate

# Run the sync script manually (replace with your actual username)
python scripts/garmin_sync.py "your-garmin-username" "garmin-tokens" "YYYY-MM-DD"
```

### Missing Python Libraries

If you encounter errors about missing Python libraries:

```bash
# Activate the virtual environment
source garmin-env/bin/activate

# Reinstall the required packages
pip install garminconnect
```

## Daily Sync Cron Job

The application includes a cron job endpoint that can be used to sync Garmin data for all users daily. To set up this cron job:

### Using a cron service (e.g., cron.daily)

Create a script that calls the cron job endpoint:

```bash
#!/bin/bash
curl -X GET https://your-app-url.com/api/cron/daily-sync -H "X-API-Key: your-secure-api-key"
```

Replace `your-app-url.com` with your application URL and `your-secure-api-key` with the API key you set in your environment variables.

### Using a scheduled task service

You can use services like Vercel Cron Jobs, AWS Lambda, or GitHub Actions to schedule a daily request to the cron job endpoint.

## Security Considerations

- Never commit your Garmin credentials to version control
- Keep your CRON_API_KEY secure and rotate it periodically
- Ensure the `garmin-tokens` directory is not publicly accessible
- Consider encrypting the stored tokens for additional security

## Support

If you encounter any issues with the Garmin integration, please contact support or create an issue in the GitHub repository. 