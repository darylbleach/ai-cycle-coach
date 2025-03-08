# Garmin Connect Integration

This component provides Python scripts for authenticating with and retrieving data from Garmin Connect.

## Features

- Authenticate with Garmin Connect
- Retrieve sleep data, including sleep score
- Get training readiness score
- Get body battery, stress, resting heart rate, and HRV data

## Integration Options

### Option 1: Vercel Python Runtime (Recommended)

Vercel now supports Python runtime for serverless functions, allowing you to run Python code directly alongside your Next.js application.

#### Implementation:

1. Create a `/api/python` directory in your Next.js project
2. Copy the Python authentication and sync functions into this directory
3. Add a `requirements.txt` file with the necessary dependencies
4. Vercel will automatically detect and deploy these as serverless functions

Example structure:
```
/api/python/
  ├── garmin_auth.py       # Python serverless function for auth
  ├── garmin_sync.py       # Python serverless function for syncing
  └── requirements.txt     # Python dependencies
```

### Option 2: Direct Integration

For development or simpler deployments, you can run the Python scripts directly using child_process from your Next.js API routes.

#### Implementation:

1. Keep Python scripts in your project
2. Call them using Node's child_process module from your API routes
3. Parse the output to get the data

Example API route:
```typescript
import { exec } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  
  return new Promise((resolve) => {
    exec(
      `python3 scripts/garmin_auth.py "${username}" "${password}"`,
      (error, stdout, stderr) => {
        if (error) {
          resolve(NextResponse.json({ error: stderr }, { status: 500 }));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          resolve(NextResponse.json(result));
        } catch (e) {
          resolve(NextResponse.json({ error: 'Invalid response from script' }, { status: 500 }));
        }
      }
    );
  });
}
```

### Option 3: AWS Lambda

For more complex or longer-running tasks, AWS Lambda provides a powerful serverless option.

#### Implementation:

1. Package your Python scripts as Lambda functions
2. Set up API Gateway to expose the functions
3. Call the API Gateway endpoints from your Next.js app

### Option 4: Digital Ocean App Platform

For a more traditional hosting approach with full control over the Python environment.

#### Implementation:

1. Deploy your Python scripts as a separate service
2. Call the service from your Next.js app

## Dependencies

- Python 3.10+
- garth==0.4.41
- garminconnect==0.1.56
- requests==2.30.0

## Security Considerations

- Store credentials securely (environment variables or secure storage)
- Use API key authentication for any exposed endpoints
- Implement proper error handling and logging 