#!/bin/sh

# Echo environment information (for debugging)
echo "Starting application with NODE_ENV: $NODE_ENV"
echo "Using DATABASE_URL: ${DATABASE_URL:0:35}..." # Only show the first part for security
echo "Using NEXTAUTH_URL: $NEXTAUTH_URL"
echo "Using PYTHON_PATH: $PYTHON_PATH"

# Basic environment variable check
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set!"
  exit 1
fi

if [ -z "$NEXTAUTH_URL" ]; then
  echo "WARNING: NEXTAUTH_URL is not set. Setting to default https://ai-cycle-coach-cxvg5.ondigitalocean.app"
  export NEXTAUTH_URL="https://ai-cycle-coach-cxvg5.ondigitalocean.app"
fi

if [ -z "$NEXTAUTH_SECRET" ]; then
  echo "WARNING: NEXTAUTH_SECRET is not set. Setting a temporary one (not secure for production)"
  export NEXTAUTH_SECRET="insecure-temporary-secret-$(date +%s)"
fi

# Extract host and port from DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

echo "Checking network access to database host: $DB_HOST port: $DB_PORT"
if command -v nc >/dev/null 2>&1; then
  # Use netcat if available
  if nc -z -w 5 $DB_HOST $DB_PORT 2>/dev/null; then
    echo "Network access to database is OK"
  else
    echo "WARNING: Cannot connect to database at $DB_HOST:$DB_PORT"
    echo "This might be a firewall or network issue."
  fi
else
  echo "Netcat not available, skipping network test"
fi

# Initialize the database
echo "Initializing database..."
./scripts/init-db.sh

# Start the application
echo "Starting Next.js application..."
npm start 