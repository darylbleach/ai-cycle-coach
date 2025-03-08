#!/bin/sh

# Script to manually initialize the database from a terminal
# This can be run after deployment to create the database tables

echo "Manual Database Initialization Script"
echo "====================================="
echo "This script will create database tables based on Prisma schema"

# Check if we're running in a container or locally
if [ -f "/.dockerenv" ]; then
  echo "Running in Docker container"
else
  echo "Running locally"
fi

# Check for environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  echo "Please set it before running this script."
  exit 1
fi

# Print DB connection string (first part only for security)
echo "Using Database URL: ${DATABASE_URL:0:35}..."

# Generate Prisma client first
echo "Generating Prisma client..."
npx prisma generate

# Connect to the database and create tables
echo "Creating database tables..."
npx prisma db push

# Apply any pending migrations
echo "Applying migrations..."
npx prisma migrate deploy

echo "Database initialization complete!"
echo ""
echo "To verify your database, you can run: npx prisma studio"
echo "This will open a web interface to explore your database." 