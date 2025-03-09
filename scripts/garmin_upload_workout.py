#!/usr/bin/env python3
"""
Script to upload a workout to Garmin Connect.

Usage: garmin_upload_workout.py <email> <token_path> <workout_json_file>
"""

import sys
import json
import logging
import os
from pathlib import Path
import re

# Import garminconnect library
try:
    from garminconnect import Garmin
    import garth
except ImportError:
    print(json.dumps({"status": "error", "error": "Missing required libraries. Please install garminconnect and garth."}))
    sys.exit(1)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("garmin_upload_workout")

def main():
    """Upload a workout to Garmin Connect."""
    if len(sys.argv) < 4:
        print(json.dumps({"status": "error", "error": "Missing arguments"}))
        sys.exit(1)
    
    email = sys.argv[1]
    token_path = sys.argv[2]
    workout_json_file = sys.argv[3]
    
    try:
        # Read workout data from file
        with open(workout_json_file, 'r') as file:
            workout_data = json.load(file)
        
        workout_name = workout_data.get('workoutName', 'Unknown')
        logger.info(f"Uploading workout '{workout_name}' for {email}")
        
        # Create token directory if it doesn't exist
        token_dir = Path(token_path)
        token_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine token file path
        token_file = token_dir / f"{email}.json"
        
        logger.info(f"Using token file: {token_file}")
        
        # Initialize API client and check if token exists
        client = None
        
        # First try to use garth for authentication (more modern approach)
        try:
            logger.info("Attempting to authenticate with garth...")
            if os.path.exists(token_file):
                with open(token_file, 'r') as f:
                    token_data = json.load(f)
                
                # If we have garth token data
                if 'garth_token' in token_data:
                    garth_token = token_data.get('garth_token')
                    garth.resume(garth_token)
                    logger.info("Authenticated with garth token")
                    client = Garmin(email)
                    client.garth = garth
                    logger.info("Using garth client for API access")
            
            if client is None:
                logger.info("No valid garth token found, trying traditional authentication")
                # Try traditional login
                client = Garmin(email)
                try:
                    client.login(tokenstore=str(token_file))
                    logger.info("Successfully logged in with token")
                except Exception as e:
                    logger.error(f"Token login failed: {e}")
                    raise Exception(f"Authentication failed: {e}")
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            print(json.dumps({"status": "error", "error": f"Authentication failed: {str(e)}"}))
            sys.exit(1)
        
        # Now try to upload the workout
        logger.info(f"Creating workout: {workout_name}")
        
        # Try connectapi method (should work with newer garminconnect versions)
        try:
            logger.info("Attempting to create workout with connectapi...")
            result = client.connectapi(
                "workout-service/workout", 
                method="POST", 
                data=json.dumps(workout_data), 
                headers={"Content-Type": "application/json"}
            )
            
            if result and 'workoutId' in result:
                workout_id = result.get('workoutId')
                logger.info(f"Workout created successfully with ID: {workout_id}")
                print(json.dumps({"status": "success", "workoutId": workout_id}))
                return
            else:
                logger.warning(f"Workout creation response didn't contain workoutId: {result}")
                # Continue to fallback methods
        except Exception as e:
            logger.error(f"Error creating workout with connectapi: {e}")
            # Continue to fallback methods
            
        # Fallback 1: Try direct API call
        try:
            logger.info("Fallback 1: Trying direct API call...")
            if hasattr(client, 'session') and client.session:
                # Build the URL
                url = "https://connect.garmin.com/modern/proxy/workout-service/workout"
                headers = {
                    "Content-Type": "application/json",
                    "NK": "NT"  # Required by some Garmin endpoints
                }
                
                # Make the POST request
                response = client.session.post(url, headers=headers, json=workout_data)
                
                if response.status_code in [200, 201]:
                    result = response.json()
                    workout_id = result.get('workoutId')
                    if workout_id:
                        logger.info(f"Workout created successfully with ID: {workout_id} (fallback 1)")
                        print(json.dumps({"status": "success", "workoutId": workout_id}))
                        return
                    else:
                        logger.warning(f"Workout creation response didn't contain workoutId: {result}")
                else:
                    logger.error(f"Error response from Garmin API: {response.status_code} - {response.text}")
            else:
                logger.error("No session available for direct API call")
        except Exception as e:
            logger.error(f"Error in fallback 1: {e}")
            
        # If we get here, all attempts failed
        logger.error("All workout creation attempts failed")
        print(json.dumps({
            "status": "error", 
            "error": "Failed to create workout after multiple attempts. Check logs for details."
        }))
        
    except Exception as e:
        logger.error(f"Error uploading workout: {str(e)}")
        print(json.dumps({"status": "error", "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main() 