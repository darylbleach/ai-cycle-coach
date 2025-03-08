FROM node:18-alpine

# Install Python 3, pip and OpenSSL (needed for Prisma)
RUN apk add --no-cache python3 py3-pip gcc python3-dev musl-dev openssl openssl-dev bash

# Set working directory
WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./

# Create scripts directory first to avoid errors
RUN mkdir -p ./scripts

# Copy Prisma schema files
COPY prisma ./prisma/

# Disable Prisma postinstall script temporarily
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

# Install Node dependencies
RUN npm ci

# Now run Prisma generate explicitly
RUN npx prisma generate

# Copy Python requirements and set up virtual environment
COPY scripts/requirements.txt ./scripts/
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r scripts/requirements.txt

# Copy the rest of the application
COPY . .

# Create token directory for Garmin authentication
RUN mkdir -p ./garmin-tokens && chmod 777 ./garmin-tokens

# Set environment variable for token directory
ENV GARMIN_TOKEN_DIR=./garmin-tokens

# Update Python path in the API routes to use venv python
ENV PYTHON_PATH=/app/venv/bin/python

# Add OpenAI API Key placeholder - replace in production environment
ENV OPENAI_API_KEY="placeholder_key_replace_in_production"

# Make the database initialization script executable
COPY scripts/init-db.sh ./scripts/
RUN chmod +x ./scripts/init-db.sh

# Build the Next.js application
RUN npm run build

# Expose the port the app will run on
EXPOSE 3000

# Start the application with database initialization
CMD ["sh", "-c", "./scripts/init-db.sh && npm start"] 