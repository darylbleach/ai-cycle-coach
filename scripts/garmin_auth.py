#!/usr/bin/env python3
"""
Garmin Authentication Script
----------------------------
This script authenticates with Garmin Connect and saves the authentication tokens.

Usage: 
    ./garmin_auth.py <email> <token_dir>

You will be prompted for your password only if needed.
"""

import os
import sys
import json
import logging
import getpass
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Try to import Garmin libraries
try:
    import garth
    from garminconnect import Garmin
except ImportError:
    logger.error("Missing required libraries. Please install with: pip install garminconnect garth")
    sys.exit(1)

def authenticate(email, token_dir):
    """Authenticate with Garmin Connect and save the token."""
    token_file = os.path.join(token_dir, f"{email}.json")
    
    # Ensure token directory exists
    if not os.path.exists(token_dir):
        os.makedirs(token_dir, exist_ok=True)
        logger.info(f"Created token directory: {token_dir}")
    
    # Check if we already have a valid token
    if os.path.exists(token_file):
        logger.info(f"Found existing token for {email}")
        try:
            with open(token_file, 'r') as f:
                token_data = json.load(f)
            
            # Check if we have a garth token
            if 'garth_token' in token_data:
                # Try to resume the session
                try:
                    garth_token = token_data['garth_token']
                    garth.resume(garth_token)
                    
                    # Test if the token works
                    client = Garmin(email)
                    client.garth = garth
                    
                    # Try to get user profile
                    try:
                        profile = client.get_user_summary()
                        display_name = profile.get('displayName', 'Unknown')
                        logger.info(f"Successfully authenticated as {display_name}")
                        
                        # Return success
                        return {
                            "success": True,
                            "message": f"Successfully authenticated as {display_name}"
                        }
                    except Exception as e:
                        logger.warning(f"Token exists but couldn't get profile: {e}")
                except Exception as e:
                    logger.warning(f"Existing token invalid, will try with password: {e}")
        except Exception as e:
            logger.warning(f"Error reading token file: {e}")
    
    # If we got here, we need to authenticate with password
    try:
        # Configure garth
        garth.configure(domain="garmin.com")
        
        # Try a headless authentication first
        password = getpass.getpass(f"Enter Garmin password for {email}: ")
        
        try:
            # Try direct login
            logger.info(f"Attempting headless login for {email}")
            garth.login(email, password)
            
            # If successful, save the token
            if garth.is_logged_in():
                tokens = garth.dumps()
                
                # Create token file
                token_data = {
                    "garth_token": json.loads(tokens)
                }
                
                with open(token_file, 'w') as f:
                    json.dump(token_data, f, indent=2)
                
                logger.info(f"Authentication successful! Token saved to {token_file}")
                
                # Test connection
                client = Garmin(email)
                client.garth = garth
                
                profile = client.get_user_summary()
                display_name = profile.get('displayName', 'Unknown')
                
                return {
                    "success": True,
                    "message": f"Successfully authenticated as {display_name}"
                }
                
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            
            # Suggest browser auth if headless fails
            print("\nHeadless authentication failed. This might be due to MFA or other security measures.")
            print("Please try using the browser-based authentication script instead:")
            print(f"  ./scripts/garmin_browser_auth.py {email} {token_dir}\n")
            
            return {
                "success": False,
                "message": f"Authentication failed: {e}"
            }
            
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {
            "success": False,
            "message": f"Authentication failed: {e}"
        }

def main():
    """Main entry point for the script."""
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <email> <token_dir>")
        sys.exit(1)
    
    email = sys.argv[1]
    token_dir = sys.argv[2]
    
    result = authenticate(email, token_dir)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main() 