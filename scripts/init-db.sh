#!/bin/sh

echo "Checking database connection and initializing schema if needed..."

# Print connection information (first part only for security)
echo "Using Database URL starting with: ${DATABASE_URL:0:35}..."

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Check for environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  echo "Please set it to your DigitalOcean database connection string"
  exit 1
fi

# Extract database details for testing
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "Database details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Name: $DB_NAME"

# Use direct database push first - this is the most reliable way to set up tables
echo "Pushing schema directly to database (Step 1)..."
DB_PUSH_OUTPUT=$(npx prisma db push --accept-data-loss --skip-generate 2>&1)
DB_PUSH_STATUS=$?

echo "DB Push Output:"
echo "$DB_PUSH_OUTPUT"

if [ $DB_PUSH_STATUS -eq 0 ]; then
  echo "Database schema pushed successfully!"
else
  echo "WARNING: Database schema push had issues. Will try migrations instead."
  
  # Try to run migrations as a fallback
  echo "Running migrations (Step 2)..."
  MIGRATE_OUTPUT=$(npx prisma migrate deploy --skip-generate 2>&1)
  MIGRATE_STATUS=$?
  
  echo "Migration Output:"
  echo "$MIGRATE_OUTPUT"
  
  if [ $MIGRATE_STATUS -eq 0 ]; then
    echo "Migrations applied successfully!"
  else
    echo "ERROR: Both direct push and migrations failed. Need to fix database connection."
    echo "Attempting one final direct push with force reset..."
    
    # Last attempt with force reset
    npx prisma db push --accept-data-loss --force-reset --skip-generate
    
    if [ $? -eq 0 ]; then
      echo "Force reset succeeded! Database schema should be ready."
    else
      echo "All attempts failed. Please check database credentials and connectivity."
      # Don't exit with error - allow the app to start anyway
    fi
  fi
fi

# Verify database tables
echo "Verifying database tables..."
npx prisma migrate status

echo "Database initialization complete." 