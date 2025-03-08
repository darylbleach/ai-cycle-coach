#!/usr/bin/env python3
"""
Garmin Authentication Script
----------------------------
This script authenticates with Garmin Connect and returns a token.
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

# Third-party imports
import garth
from garminconnect import Garmin

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get token directory from environment or use default
TOKEN_DIR = os.getenv('GARMIN_TOKEN_DIR', './garmin-tokens')

def load_token(username: str) -> Optional[Dict[str, Any]]:
    """Load token from file."""
    try:
        token_path = Path(TOKEN_DIR) / f"{username}.json"
        if not token_path.exists():
            return None
            
        with open(token_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading token: {e}")
        return None

def save_token(username: str, token_data: Dict[str, Any]) -> bool:
    """Save token to file."""
    try:
        # Ensure directory exists
        token_dir = Path(TOKEN_DIR)
        token_dir.mkdir(parents=True, exist_ok=True)
        
        # Save token
        token_path = token_dir / f"{username}.json"
        with open(token_path, 'w') as f:
            json.dump(token_data, f)
        return True
    except Exception as e:
        logger.error(f"Error saving token: {e}")
        return False

def authenticate(username: str, password: str = None) -> Dict[str, Any]:
    """Authenticate with Garmin Connect."""
    try:
        # Check for existing token
        token = load_token(username)
        if token:
            logger.info(f"Found existing token for {username}")
            try:
                # Try to use existing token
                garth.client.loads(token)
                # Test if token is valid
                client = Garmin(token)
                client.get_user_summary()
                return {"success": True, "message": "Authentication successful using existing token"}
            except Exception as e:
                logger.warning(f"Existing token invalid, will try with password: {e}")
                # Continue with password auth
        
        if not password:
            return {"success": False, "message": "No valid token found and no password provided"}
        
        # Authenticate with credentials
        garth.login(username, password)
        token = garth.client.dumps()
        save_token(username, token)
        
        # Test authentication
        client = Garmin(token)
        client.get_user_summary()
        
        return {
            "success": True,
            "message": "Authentication successful with provided credentials",
            "username": username
        }
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return {"success": False, "message": f"Authentication failed: {str(e)}"}

def main():
    """Main function to handle CLI usage."""
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "message": "Username required"}))
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else None
    
    result = authenticate(username, password)
    print(json.dumps(result))

if __name__ == "__main__":
    main() 