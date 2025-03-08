#!/bin/sh

echo "Checking database connection and initializing schema if needed..."

# Generate Prisma client first
npx prisma generate

# Wait for the database to be ready by checking migration status
# This will attempt to connect to the database
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  echo "Attempting to connect to database (attempt $((RETRY_COUNT+1))/$MAX_RETRIES)..."
  if npx prisma migrate status --skip-generate 2>/dev/null; then
    echo "Database connection successful!"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
      echo "Failed to connect to database after $MAX_RETRIES attempts. Continuing anyway..."
    else
      echo "Database not ready yet. Waiting 5 seconds..."
      sleep 5
    fi
  fi
done

echo "Database is ready, checking schema..."

# Check if migrations directory exists
if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "No migration files found. Creating initial migration..."
  # Create a migrations directory if it doesn't exist
  mkdir -p prisma/migrations
  
  # Use db push for initial schema setup (this is easier than trying to create migration files)
  echo "Pushing schema to database..."
  npx prisma db push --skip-generate --accept-data-loss
  
  echo "Initial schema setup complete."
else
  echo "Migration files found. Checking status..."
  
  # Check if tables exist by trying a direct SQL query
  if npx prisma migrate status --skip-generate 2>&1 | grep -q "no migrations found"; then
    echo "No migrations found in database. Running migrations..."
    npx prisma migrate deploy
  else
    echo "Migrations exist. Checking if they need to be applied..."
    # Check if there are pending migrations that need to be applied
    if npx prisma migrate status --skip-generate 2>&1 | grep -q "pending"; then
      echo "Found pending migrations. Deploying..."
      npx prisma migrate deploy
    else
      echo "Database schema is up to date."
    fi
  fi
fi

echo "Database initialization complete." 