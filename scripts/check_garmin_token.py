#!/usr/bin/env python3
import os
import sys
import json
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)

# Get token directory from environment or use default
TOKEN_DIR = os.getenv('GARMIN_TOKEN_DIR', './garmin-tokens')

def check_token_file(username):
    """Check if a token file exists for the given username."""
    try:
        # Ensure token directory exists
        token_dir = Path(TOKEN_DIR)
        
        if not token_dir.exists():
            logger.error(f"Token directory does not exist: {token_dir}")
            return False
            
        # Create expected session file path
        token_filename = f"{username.replace('@', '_').replace('.', '_')}.json"
        session_file = token_dir / token_filename
        
        logger.info(f"Checking for token file: {session_file}")
        logger.info(f"Absolute path: {session_file.absolute()}")
        
        # List all files in token directory
        logger.info(f"Files in token directory:")
        for file in token_dir.glob('*'):
            logger.info(f"  - {file}")
        
        if not session_file.exists():
            logger.error(f"Token file does not exist: {session_file}")
            return False
            
        # Try to read the file
        try:
            with open(session_file, 'r') as f:
                data = json.load(f)
                # Only print part of the content for security
                logger.info(f"Token file exists and contains valid JSON")
                logger.info(f"Keys in token file: {list(data.keys())}")
                return True
        except Exception as e:
            logger.error(f"Error reading token file: {e}")
            return False
        
    except Exception as e:
        logger.error(f"Error checking token file: {e}")
        return False

def main():
    """Main function."""
    if len(sys.argv) < 2:
        print("Usage: python check_garmin_token.py <username>")
        sys.exit(1)
        
    username = sys.argv[1]
    result = check_token_file(username)
    
    if result:
        print("\nToken file exists and is valid.")
    else:
        print("\nToken file does not exist or is invalid.")
        
if __name__ == "__main__":
    main() 