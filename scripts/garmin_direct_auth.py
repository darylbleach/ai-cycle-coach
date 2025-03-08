#!/usr/bin/env python3
"""
Direct Garmin Authentication Script
----------------------------------
Authenticate with Garmin Connect using the garminconnect library
"""

import os
import sys
import json
import logging
from pathlib import Path

# Third-party imports
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get token directory from environment or use default
TOKEN_DIR = os.getenv('GARMIN_TOKEN_DIR', './garmin-tokens')


def authenticate(username, password):
    """Authenticate with Garmin Connect."""
    try:
        # Ensure token directory exists
        token_dir = Path(TOKEN_DIR)
        token_dir.mkdir(parents=True, exist_ok=True)
        
        # Create session file path - use raw username to match sync script
        session_file = token_dir / f"{username}.json"
        
        # Debug information
        logger.info(f"Using session file at: {session_file} (absolute: {session_file.absolute()})")
        logger.info(f"Token directory: {token_dir} (absolute: {token_dir.absolute()})")
        
        # Initialize Garmin client
        logger.info(f"Initializing Garmin client with session file: {session_file}")
        
        # Use Garmin client with token store
        client = Garmin(username, password)
        client.session_data_path = str(session_file)
        
        # Try to login - this will use stored tokens if available
        try:
            logger.info("Attempting to login...")
            client.login()
            logger.info("Login successful!")
        except Exception as login_error:
            logger.error(f"Login error: {str(login_error)}")
            logger.info("Trying to clear session and login again...")
            
            # If first login failed, try removing the session file and login again
            if session_file.exists():
                session_file.unlink()
                logger.info("Removed old session file")
            
            # Try login again
            try:
                client.login()
                logger.info("Second login attempt successful!")
            except Exception as second_login_error:
                logger.error(f"Second login attempt failed: {str(second_login_error)}")
                return {
                    "status": "error",
                    "message": f"Authentication failed: {str(second_login_error)}",
                    "error_type": "login_error"
                }
        
        # Verify login by getting user profile
        try:
            logger.info("Verifying authentication by getting user profile...")
            profile = client.get_user_profile()
            
            full_name = profile.get('fullName', 'Unknown')
            display_name = profile.get('displayName', 'Unknown')
            logger.info(f"Successfully retrieved profile for {full_name} ({display_name})")
            
            # Check if the session file actually exists
            if not session_file.exists():
                logger.warning("Authentication successful but session file not created - forcing save")
                # Force save the session data
                with open(session_file, 'w') as f:
                    # Get the session data from client
                    if hasattr(client, 'oauth1_token') and hasattr(client, 'oauth2_token'):
                        session_data = {
                            'oauth1_token': client.oauth1_token,
                            'oauth2_token': client.oauth2_token
                        }
                        json.dump(session_data, f)
                        logger.info(f"Manually saved session data to {session_file}")
                    else:
                        logger.error("Client doesn't have token data to save")
                        raise Exception("Failed to save token data - client has no tokens")
            
            # Verify file exists now
            if session_file.exists():
                logger.info(f"Verified session file exists at {session_file}")
            else:
                raise Exception("Failed to create session file")
                
            return {
                "status": "success",
                "message": "Successfully authenticated with Garmin Connect",
                "userData": {
                    "fullName": full_name,
                    "displayName": display_name
                }
            }
                
        except Exception as profile_error:
            logger.error(f"Error retrieving profile: {str(profile_error)}")
            
            # Check if we've signed in successfully despite profile error
            if hasattr(client, 'display_name') and client.display_name:
                logger.info(f"Have display name: {client.display_name}, considering login successful")
                return {
                    "status": "success",
                    "message": "Successfully authenticated to Garmin Connect",
                    "userData": {
                        "displayName": client.display_name
                    }
                }
            else:
                return {
                    "status": "error",
                    "message": f"Failed to verify authentication: {str(profile_error)}",
                    "error_type": "verification_error"
                }
                
    except (
        GarminConnectConnectionError,
        GarminConnectAuthenticationError,
        GarminConnectTooManyRequestsError,
        Exception
    ) as err:
        logger.error(f"Unexpected error: {str(err)}")
        return {
            "status": "error",
            "message": f"Unexpected error during authentication: {str(err)}",
            "error_type": "unexpected_error"
        }


def main():
    """Main function to handle CLI usage."""
    if len(sys.argv) != 3:
        print(json.dumps({
            "status": "error",
            "message": "Usage: python garmin_direct_auth.py <username> <password>"
        }))
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    
    result = authenticate(username, password)
    print(json.dumps(result))


if __name__ == "__main__":
    main() 