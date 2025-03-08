#!/bin/sh

# Setup Python environment for Docker/Production
echo "Setting up Python environment for Garmin Connect integration..."

# Check if using Docker environment (should use PYTHON_PATH)
if [ -n "$PYTHON_PATH" ]; then
  echo "Using Python path from environment: $PYTHON_PATH"
  # Create garmin tokens directory if needed
  mkdir -p garmin-tokens
else
  # For Vercel or local development
  # Create virtual environment directory if it doesn't exist
  mkdir -p garmin-env/bin

  # Install Python dependencies from requirements.txt
  pip install -r requirements.txt -t .vercel/python

  # Create a symlink for the Python executable so our paths still work
  mkdir -p $(dirname $0)/garmin-env/bin/
  ln -sf $(which python3) $(dirname $0)/garmin-env/bin/python

  # Create garmin tokens directory
  mkdir -p garmin-tokens
fi

# Print info about the environment
echo "Python environment set up complete."
python3 --version
echo "Python dependencies installed:"
python3 -m pip list

# Return success
exit 0 