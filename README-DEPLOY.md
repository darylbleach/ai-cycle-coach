# DigitalOcean Deployment Guide

## Required Environment Variables

When deploying to DigitalOcean, you must set the following environment variables in the App Platform:

### Critical Database Connection
```
DATABASE_URL=postgresql://username:password@hostname:port/database?sslmode=require
```
Use your actual DigitalOcean database credentials here.

### Authentication
```
NEXTAUTH_URL=https://ai-cycle-coach-cxvg5.ondigitalocean.app
NEXTAUTH_SECRET=<generate-a-secure-random-string>
```

### Google OAuth (for user login)
```
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

### OpenAI (for training plan generation)
```
OPENAI_API_KEY=<your-openai-api-key>
```

### Other Required Settings
```
NODE_ENV=production
PYTHON_PATH=/app/venv/bin/python
GARMIN_TOKEN_DIR=/app/garmin-tokens
USE_SAMPLE_DATA=false
CRON_API_KEY=<your-cron-api-key>
INTERNAL_API_KEY=<your-internal-api-key-for-workout-adjustment>
```

## Deployment Steps

1. In your DigitalOcean App Platform:
   - Go to Settings > Environment Variables
   - Add all the variables listed above
   
2. Force a rebuild and deploy:
   - Go to the Overview tab
   - Click "..." menu > "Force Rebuild and Deploy"

3. Check the logs to ensure database initialization completes successfully

## Troubleshooting

If you experience database connection issues:

1. Verify the DATABASE_URL is correct
2. Check that your database firewall allows connections from the App Platform
3. Look for "Database connection successful!" in the logs 