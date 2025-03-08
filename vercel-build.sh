#!/bin/bash

# Setup Python environment for Vercel
echo "Setting up Python environment for Garmin Connect integration..."

# Create virtual environment directory if it doesn't exist
mkdir -p garmin-env/bin

# Install Python dependencies from requirements.txt
pip install -r requirements.txt -t .vercel/python

# Create a symlink for the Python executable so our paths still work
mkdir -p $(dirname $0)/garmin-env/bin/
ln -sf $(which python3) $(dirname $0)/garmin-env/bin/python

# Create garmin tokens directory
mkdir -p garmin-tokens

# Print info about the environment
echo "Python environment set up complete."
python3 --version
echo "Python dependencies installed in .vercel/python:"
ls -la .vercel/python

# Return success
exit 0 