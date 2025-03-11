#!/usr/bin/env python3
"""
Garmin Browser Authentication Script
------------------------------------
This script helps authenticate with Garmin Connect using a browser session.
It's more reliable than headless authentication when MFA is enabled.

Usage: garmin_browser_auth.py <email> <token_dir>

This will open a browser window to authenticate with Garmin Connect.
"""

import os
import sys
import json
import time
import logging
import getpass
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

try:
    import garth
    from garminconnect import Garmin
except ImportError:
    logger.error("Missing required libraries. Please install garminconnect and garth with pip.")
    sys.exit(1)

def authenticate_with_browser(email, token_dir):
    """Authenticate with Garmin Connect using browser session."""
    logger.info(f"Starting browser authentication for {email}")
    
    # Create token directory if it doesn't exist
    token_path = Path(token_dir)
    token_path.mkdir(parents=True, exist_ok=True)
    
    # Set up token file path
    token_file = token_path / f"{email}.json"
    
    try:
        # Initialize garth for browser authentication
        garth.configure(domain="garmin.com")
        
        # Start the authentication process
        print("\n==== Garmin Connect Authentication ====")
        print(f"Opening browser for {email} authentication")
        
        # Get password
        password = getpass.getpass(f"Enter Garmin password for {email}: ")
        
        print("Attempting to authenticate...")
        
        # Start the OAuth process with password
        garth.login(email, password)
        
        print("\nAuthentication successful!")
        
        # Get tokens and save them
        tokens = garth.client.dumps()
        
        # Create a token file
        token_data = {
            "garth_token": json.loads(tokens)
        }
        
        with open(token_file, 'w') as f:
            json.dump(token_data, f, indent=2)
        
        logger.info(f"Saved authentication tokens to {token_file}")
        
        # Test the connection
        client = Garmin(email)
        client.garth = garth
        
        # Get user details to verify the connection
        try:
            profile = client.get_user_summary()
            display_name = profile.get('displayName', 'Unknown')
            logger.info(f"Successfully connected to Garmin Connect as {display_name}")
            
            # Print success message
            print(f"\nSuccessfully authenticated as: {display_name}")
            print(f"Token saved to: {token_file}")
            
            return {
                "success": True,
                "message": f"Authentication successful for {email}",
                "display_name": display_name
            }
            
        except Exception as e:
            logger.error(f"Error testing connection: {str(e)}")
            return {
                "success": False,
                "message": f"Authentication succeeded, but connection test failed: {str(e)}"
            }
            
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": f"Authentication failed: {str(e)}"
        }

def main():
    """Main entry point for the script."""
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <email> <token_dir>")
        sys.exit(1)
    
    email = sys.argv[1]
    token_dir = sys.argv[2]
    
    result = authenticate_with_browser(email, token_dir)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main() 