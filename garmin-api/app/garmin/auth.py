import os
import json
import logging
import garth
from typing import Dict, Any, Optional
from ..config import settings

# Setup logger
logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

def load_token(username: str) -> Optional[Dict[str, Any]]:
    """Load authentication token from file
    
    Args:
        username: Garmin Connect username (email)
        
    Returns:
        Dictionary with token data or None if not found
    """
    # Ensure token directory exists
    if not os.path.exists(settings.GARMIN_TOKEN_DIR):
        os.makedirs(settings.GARMIN_TOKEN_DIR, exist_ok=True)
    
    token_path = os.path.join(settings.GARMIN_TOKEN_DIR, f"{username}.json")
    
    if not os.path.exists(token_path):
        logger.debug(f"No token file found for user {username}")
        return None
    
    try:
        with open(token_path, "r") as f:
            token_data = json.load(f)
            logger.debug(f"Successfully loaded token for user {username}")
            return token_data
    except Exception as e:
        logger.error(f"Error loading token for user {username}: {str(e)}")
        return None

def save_token(username: str, token_data: Dict[str, Any]) -> bool:
    """Save authentication token to file
    
    Args:
        username: Garmin Connect username (email)
        token_data: Dictionary with token data
        
    Returns:
        True if successful, False otherwise
    """
    # Ensure token directory exists
    if not os.path.exists(settings.GARMIN_TOKEN_DIR):
        os.makedirs(settings.GARMIN_TOKEN_DIR, exist_ok=True)
    
    token_path = os.path.join(settings.GARMIN_TOKEN_DIR, f"{username}.json")
    
    try:
        with open(token_path, "w") as f:
            json.dump(token_data, f)
        logger.debug(f"Successfully saved token for user {username}")
        return True
    except Exception as e:
        logger.error(f"Error saving token for user {username}: {str(e)}")
        return False

async def authenticate(username: str, password: str = None) -> Dict[str, Any]:
    """Authenticate with Garmin Connect
    
    Args:
        username: Garmin Connect username (email)
        password: Garmin Connect password (optional if token exists)
        
    Returns:
        Dictionary with authentication status
    """
    try:
        # Try to load existing token
        token_data = load_token(username)
        
        if token_data:
            # Restore the session from saved token
            logger.info(f"Attempting to resume session for user {username}")
            garth.resume(token_data)
            
            try:
                # Verify the token is still valid by making a test API call
                garth.client.get('/usersummary-service/usersummary/daily/latest')
                logger.info(f"Successfully resumed session for user {username}")
            except Exception as e:
                logger.warning(f"Token expired for user {username}, needs re-authentication: {str(e)}")
                
                # If no password provided, we can't re-authenticate
                if not password:
                    return {"status": "error", "message": "Session expired, password required"}
                
                # Try to login with credentials
                garth.login(username, password)
                # Save the token for future use
                token_data = garth.dump()
                save_token(username, token_data)
        else:
            # No token exists, need username and password
            if not password:
                logger.error(f"No token found and no password provided for user {username}")
                return {"status": "error", "message": "Password required for first login"}
            
            # Login with credentials
            logger.info(f"Attempting to login with credentials for user {username}")
            garth.login(username, password)
            # Save the token for future use
            token_data = garth.dump()
            save_token(username, token_data)
            logger.info(f"Successfully logged in with credentials for user {username}")
        
        return {"status": "success", "message": "Authentication successful"}
    except Exception as e:
        logger.error(f"Authentication error for user {username}: {str(e)}")
        return {"status": "error", "message": str(e)} 