#!/bin/sh

# Echo environment information (for debugging)
echo "Starting application with NODE_ENV: $NODE_ENV"
echo "Using DATABASE_URL: ${DATABASE_URL:0:35}..." # Only show the first part for security
echo "Using NEXTAUTH_URL: $NEXTAUTH_URL"
echo "Using PYTHON_PATH: $PYTHON_PATH"

# Initialize the database
echo "Initializing database..."
./scripts/init-db.sh

# Start the application
echo "Starting Next.js application..."
npm start 