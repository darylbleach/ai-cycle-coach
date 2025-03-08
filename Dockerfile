FROM node:18-alpine

# Install Python 3 and pip
RUN apk add --no-cache python3 py3-pip gcc python3-dev musl-dev

# Set working directory
WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm ci

# Copy Python requirements and install Python dependencies
COPY scripts/requirements.txt ./scripts/
RUN pip3 install --no-cache-dir -r scripts/requirements.txt

# Copy the rest of the application
COPY . .

# Create token directory for Garmin authentication
RUN mkdir -p ./garmin-tokens && chmod 777 ./garmin-tokens

# Set environment variable for token directory
ENV GARMIN_TOKEN_DIR=./garmin-tokens

# Build the Next.js application
RUN npm run build

# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 