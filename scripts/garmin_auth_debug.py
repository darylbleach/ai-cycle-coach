#!/usr/bin/env python3
# scripts/garmin_auth_debug.py
import sys
import json
import os
import traceback
import logging
from pathlib import Path
import garth
import requests
from garminconnect import Garmin

# Set up logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                   stream=sys.stderr)
logger = logging.getLogger("GarminAuthDebug")

def authenticate(username, password, token_dir):
    try:
        logger.info(f"Starting authentication debug for user {username}")
        
        # Check if token directory exists
        if not os.path.exists(token_dir):
            logger.info(f"Token directory {token_dir} does not exist")
            os.makedirs(token_dir, exist_ok=True)
            logger.info(f"Created token directory {token_dir}")
        
        # Network connectivity test
        try:
            logger.info("Testing network connectivity to Garmin servers...")
            test_resp = requests.get("https://connect.garmin.com", timeout=10)
            logger.info(f"Network test status: {test_resp.status_code}")
            logger.debug(f"Headers: {test_resp.headers}")
        except Exception as e:
            logger.error(f"Network connectivity test failed: {str(e)}")
        
        try:
            logger.info("Initializing Garmin client for authentication")
            
            # Create a fresh client for debugging
            logger.info("Creating a new authentication session")
            garth_client = garth.Client(domain="garmin.com")
            
            # Attempt to log in with detailed error handling
            try:
                logger.info("Attempting login...")
                garth_client.login(username, password)
                logger.info("Login successful")
                
                # Save the successful token
                token_file = os.path.join(token_dir, f"{username}_debug.json")
                logger.info(f"Saving token to {token_file}")
                garth_client.dump(token_file)
                logger.info("Token saved successfully")
                
                # Print success
                print(json.dumps({"status": "success", "message": "Authentication successful in debug mode"}))
                
            except Exception as e:
                logger.error(f"Login attempt failed: {str(e)}")
                logger.error(f"Detailed traceback: {traceback.format_exc()}")
                
                # Special handling for 401 errors
                if "401" in str(e) and "Unauthorized" in str(e):
                    logger.error("This appears to be an authentication issue with Garmin's servers.")
                    logger.error("Possible causes:")
                    logger.error("1. Incorrect username or password")
                    logger.error("2. Two-factor authentication is enabled on your Garmin account")
                    logger.error("3. Garmin may have detected automated access and temporarily blocked this IP")
                    logger.error("4. Garmin may have updated their authentication system")
                
                print(json.dumps({
                    "status": "error", 
                    "message": f"Authentication failed: {str(e)}",
                    "error_type": str(type(e).__name__),
                    "possible_solutions": [
                        "Verify your Garmin Connect username and password",
                        "Try disabling two-factor authentication on your Garmin account",
                        "Try again later if your IP might be temporarily blocked",
                        "Check for updates to the garminconnect and garth libraries"
                    ]
                }))
                sys.exit(1)
            
        except Exception as e:
            logger.error(f"Failed to initialize Garmin client: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            print(json.dumps({"status": "error", "message": f"Client initialization failed: {str(e)}"}))
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        print(json.dumps({"status": "error", "message": f"Unexpected error: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        logger.error(f"Incorrect number of arguments: {len(sys.argv)}")
        print(json.dumps({"status": "error", "message": "Usage: python garmin_auth_debug.py <username> <password> <token_dir>"}))
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    token_dir = sys.argv[3]
    authenticate(username, password, token_dir) 