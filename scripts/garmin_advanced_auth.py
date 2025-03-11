#!/usr/bin/env python3
"""
Advanced Garmin Authentication Script
------------------------------------
This script provides a more robust authentication method for Garmin Connect.
It combines garth and garminconnect libraries for better reliability.

Usage: garmin_advanced_auth.py <email> [password]

If password is not provided, it will be prompted securely.
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

# Paths and directories
TOKEN_DIR = os.getenv('GARMIN_TOKEN_DIR', './garmin-tokens')

def clear_existing_tokens(email, token_dir):
    """Clear any existing tokens for debugging purposes."""
    logger.info(f"Clearing existing tokens for {email}")
    
    # Define file paths
    token_path = Path(token_dir)
    token_file = token_path / f"{email}.json"
    
    # Remove token file if it exists
    if token_file.exists():
        logger.info(f"Removing token file: {token_file}")
        token_file.unlink()
    
    logger.info("Existing tokens cleared.")

def authenticate(email, password=None, clear_tokens=False):
    """Authenticate with Garmin Connect using multiple methods."""
    try:
        logger.info(f"Starting authentication for {email}")
        
        # Create token directory if it doesn't exist
        token_path = Path(TOKEN_DIR)
        token_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Using token directory: {token_path.absolute()}")
        
        # Set up token file path
        token_file = token_path / f"{email}.json"
        logger.info(f"Token file will be saved at: {token_file.absolute()}")
        
        # Clear tokens if requested
        if clear_tokens:
            clear_existing_tokens(email, TOKEN_DIR)
        
        # If no password is provided, prompt for it
        if not password:
            password = getpass.getpass(f"Enter Garmin password for {email}: ")
        
        # Initialize garth for authentication
        garth.configure(domain="garmin.com")
        
        # Try to authenticate
        success = False
        error_message = None
        
        # First attempt with garth direct login
        logger.info("Attempt 1: Direct garth login")
        try:
            garth.login(email, password)
            
            if garth.client.oauth2_token:
                logger.info("Direct garth login successful!")
                success = True
            else:
                logger.error("Garth login appeared to succeed but no oauth2_token was found")
        except Exception as e:
            logger.error(f"Attempt 1 failed: {str(e)}")
            error_message = str(e)
        
        # Second attempt with garminconnect
        if not success:
            logger.info("Attempt 2: Using garminconnect library")
            try:
                client = Garmin(email, password)
                client.login()
                logger.info("Garminconnect login successful!")
                success = True
            except Exception as e:
                logger.error(f"Attempt 2 failed: {str(e)}")
                error_message = error_message or str(e)
        
        # Last attempt with garth but using browser method
        if not success:
            logger.info("Attempt 3: Using garth browser-like login flow")
            try:
                # Reset garth client
                garth.client.oauth2_token = None
                
                # Try with specific headers/cookies to simulate browser
                garth.client.authenticate(email, password)
                
                if garth.client.oauth2_token:
                    logger.info("Browser-like garth login successful!")
                    success = True
                else:
                    logger.error("Browser-like login appeared to succeed but no oauth2_token was found")
            except Exception as e:
                logger.error(f"Attempt 3 failed: {str(e)}")
                error_message = error_message or str(e)
        
        # If any method succeeded, save the tokens
        if success:
            # Get tokens from garth
            if garth.client.oauth2_token:
                logger.info("Saving garth tokens to file")
                tokens = garth.dumps()
                
                # Create token file with garth token
                token_data = {
                    "garth_token": json.loads(tokens)
                }
                
                with open(token_file, 'w') as f:
                    json.dump(token_data, f, indent=2)
                
                logger.info(f"Saved authentication tokens to {token_file}")
                
                # Test the connection
                try:
                    # Create a client using garth
                    test_client = Garmin(email)
                    test_client.garth = garth
                    
                    # Get user profile to verify authentication
                    profile = test_client.get_user_summary()
                    display_name = profile.get('displayName', 'Unknown')
                    
                    logger.info(f"Successfully verified connection as {display_name}")
                    
                    return {
                        "status": "success",
                        "message": f"Authentication successful for {email}",
                        "userData": {
                            "displayName": display_name,
                            "fullName": profile.get('fullName', display_name)
                        }
                    }
                except Exception as verify_error:
                    logger.error(f"Token saved but verification failed: {str(verify_error)}")
                    return {
                        "status": "warning",
                        "message": f"Authentication may have succeeded but verification failed: {str(verify_error)}",
                        "userData": {
                            "displayName": "Garmin User"
                        }
                    }
            else:
                logger.error("Authentication succeeded but no oauth2_token available to save")
                return {
                    "status": "error",
                    "message": "Authentication succeeded but failed to obtain tokens"
                }
        else:
            # All attempts failed
            logger.error("All authentication attempts failed")
            return {
                "status": "error",
                "message": f"Authentication failed: {error_message}",
                "error_type": "auth_failure"
            }
    
    except Exception as e:
        logger.error(f"Unexpected error during authentication: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Unexpected error: {str(e)}",
            "error_type": "unexpected_error"
        }

def main():
    """Main entry point for the script."""
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <email> [password] [--clear-tokens]")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "--clear-tokens" else None
    clear_tokens = "--clear-tokens" in sys.argv
    
    result = authenticate(email, password, clear_tokens)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main() 