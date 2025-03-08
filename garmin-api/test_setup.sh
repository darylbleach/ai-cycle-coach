#!/bin/bash

# Check Python and required packages
echo "===== Checking Python installation ====="
which python3 || { echo "Python not found"; exit 1; }
echo "Python found at: $(which python3)"
python3 --version

# Create virtual environment for testing
echo "===== Creating test environment ====="
if [ -d "venv_test" ]; then
  echo "Removing existing test environment"
  rm -rf venv_test
fi

python3 -m venv venv_test
source venv_test/bin/activate

# Install dependencies
echo "===== Installing dependencies ====="
pip install -r requirements.txt

# Start the FastAPI server in the background
echo "===== Starting FastAPI server for testing ====="
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!

# Give the server time to start
sleep 3

# Test the health endpoint
echo "===== Testing health endpoint ====="
curl -s http://localhost:8000/health | grep healthy

# Clean up
echo "===== Cleaning up ====="
kill $SERVER_PID
deactivate
rm -rf venv_test

echo "===== Test completed =====" 