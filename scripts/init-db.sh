#!/bin/sh

echo "Checking database connection and initializing schema if needed..."

# Generate Prisma client first
npx prisma generate

# Print DB connection string (first part only)
echo "Using Database URL: ${DATABASE_URL:0:35}..."

# Check for environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

# Wait for the database to be ready by testing a direct push command
MAX_RETRIES=15
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  echo "Attempting to connect to database (attempt $((RETRY_COUNT+1))/$MAX_RETRIES)..."
  
  # Try database connection with a simple query
  if npx prisma db push --skip-generate --accept-data-loss --force-reset 2>&1 | grep -q "done"; then
    echo "Database connection successful!"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
      echo "Failed to connect to database after $MAX_RETRIES attempts."
      echo "Will continue anyway and try to apply migrations. Check database configuration."
    else
      echo "Database not ready yet. Waiting 10 seconds..."
      sleep 10
    fi
  fi
done

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Database initialization complete." 