#!/usr/bin/env python3
"""
Script to upload a workout to Garmin Connect.

Usage: garmin_upload_workout.py <email> <token_path> <workout_json_file>
"""

import sys
import json
import logging
import os
import inspect
from garminconnect import Garmin

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
        
        logger.info(f"Uploading workout '{workout_data.get('workoutName', 'Unknown')}' for {email}")
        
        # Initialize API client
        client = Garmin(email)
        
        # Attempt to login with token
        token_file = token_path
        if os.path.isdir(token_path):
            token_file = os.path.join(token_path, f"{email}.json")
        
        logger.info(f"Loading token from {token_file}")
        try:
            client.login(tokenstore=token_file)
            logger.info("Successfully logged in with token")
        except Exception as e:
            logger.error(f"Token login failed: {e}")
            raise Exception(f"Authentication failed: {e}")
        
        # Log available methods for debugging
        methods = [method for method in dir(client) if not method.startswith('_') and callable(getattr(client, method))]
        logger.info(f"Available methods: {methods}")
        
        # Try to create workout
        logger.info(f"Creating workout: {workout_data.get('workoutName', 'Unnamed')}")
        
        # First, inspect connectapi to understand its usage
        try:
            # Get the signature of connectapi
            connectapi_sig = inspect.signature(client.connectapi)
            logger.info(f"connectapi signature: {connectapi_sig}")
            
            # CORRECTLY use connectapi with kwargs not positional args
            logger.info("Attempting to create workout with connectapi")
            # Note: path is first arg, then we pass data as **kwargs
            result = client.connectapi("workout-service/workout", 
                                      method="POST", 
                                      data=json.dumps(workout_data), 
                                      headers={"Content-Type": "application/json"})
            
            logger.info(f"connectapi result: {result}")
            success = True
            
            # If we get here without an exception, we succeeded
            print(json.dumps({"status": "success", "workoutId": result.get("workoutId", "unknown")}))
            return
            
        except Exception as e:
            logger.error(f"Error creating workout with connectapi: {e}")
            
            # Try directly inspecting the function
            logger.info("Inspecting connectapi function")
            try:
                source = inspect.getsource(client.connectapi)
                logger.info(f"connectapi source: {source}")
            except Exception as es:
                logger.error(f"Could not get source: {es}")
        
        # Fallback: Try to examine existing functions to understand API
        try:
            logger.info("Examining upload_activity for reference")
            try:
                source = inspect.getsource(client.upload_activity)
                logger.info(f"upload_activity source: {source}")
            except Exception as es:
                logger.error(f"Could not get source: {es}")
                
            # Try to see how downloading works (may give clues about format)
            logger.info("Examining download_workout for reference")
            try:
                source = inspect.getsource(client.download_workout)
                logger.info(f"download_workout source: {source}")
            except Exception as es:
                logger.error(f"Could not get source: {es}")
                
            # Try to log what endpoints are used for other operations
            logger.info("Trying to fetch workout by ID to understand endpoints")
            # Check if any workout IDs are passed in workout data
            workout_id = workout_data.get("workoutId")
            if workout_id:
                try:
                    workout = client.get_workout_by_id(workout_id)
                    logger.info(f"Fetched workout: {workout}")
                except Exception as e:
                    logger.error(f"Failed to fetch workout: {e}")
            
        except Exception as e:
            logger.error(f"Failed to examine API: {e}")
        
        # If all attempts failed, return a detailed error
        raise Exception("Failed to create workout. See logs for details.")
        
    except Exception as e:
        logger.error(f"Error uploading workout: {str(e)}")
        print(json.dumps({"status": "error", "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main() 