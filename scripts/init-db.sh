#!/bin/sh

echo "Checking database connection and initializing schema if needed..."

# Wait for the database to be ready
until npx prisma db ping --skip-generate; do
  echo "Database is not ready - waiting..."
  sleep 2
done

echo "Database is ready, checking schema..."

# Run 'prisma generate' to generate the Prisma Client
npx prisma generate

# Check if the User table exists by trying to count records
USER_COUNT=$(npx prisma db execute --command="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User'" --skip-generate 2>/dev/null || echo "0")

# If the User table doesn't exist, run migrations
if [ "$USER_COUNT" = "0" ]; then
  echo "Database tables not found. Running migrations..."
  npx prisma migrate deploy
else
  echo "Database tables already exist. Skipping migrations."
fi

echo "Database initialization complete." 