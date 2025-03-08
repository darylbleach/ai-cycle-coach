#!/usr/bin/env python3
"""
Direct Garmin Sync Script
-------------------------
Sync health data directly from Garmin Connect using the garminconnect library
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
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


def get_real_current_date():
    """Get the current date, with fallback to system time if external API fails."""
    try:
        # Use system date
        return datetime.now()
    except Exception as e:
        logger.error(f"Error getting date: {e}")
        # Fallback to system date if error occurs
        return datetime.now()


def sync_data(username, date_str=None, password=None):
    """Sync health data from Garmin Connect."""
    try:
        logger.info(f"Starting sync for user {username}")

        # Get the current date
        current_date = get_real_current_date()
        logger.info(f"Current date: {current_date.strftime('%Y-%m-%d')}")

        # Process the requested date or use current date
        if not date_str:
            # Default to today if no date provided
            date_str = current_date.strftime("%Y-%m-%d")
            logger.info(f"No date provided, using today: {date_str}")
        else:
            # Validate the requested date is not in the future
            try:
                requested_date = datetime.strptime(date_str, "%Y-%m-%d")
                # If requested date is in the future, use today instead
                if requested_date > current_date:
                    logger.warning(f"Requested date {date_str} is in the future. Using today instead.")
                    date_str = current_date.strftime("%Y-%m-%d")
            except ValueError:
                logger.error(f"Invalid date format: {date_str}")
                # Fall back to today
                date_str = current_date.strftime("%Y-%m-%d")
                logger.info(f"Using today's date: {date_str}")

        # Ensure token directory exists
        token_dir = Path(TOKEN_DIR)
        token_dir.mkdir(parents=True, exist_ok=True)

        client = None
        
        # Try direct authentication first if password is provided
        if password:
            logger.info("Password provided, trying direct authentication...")
            try:
                client = Garmin(username, password)
                client.login()
                logger.info("Direct authentication successful!")
            except Exception as auth_error:
                logger.error(f"Direct authentication failed: {auth_error}")
                client = None
        
        # If direct auth failed or wasn't attempted, try session-based authentication
        if client is None:
            # Create session file path - use the same format as auth script
            session_file = token_dir / f"{username}.json"
            
            # Debug information
            logger.info(f"Looking for session file at: {session_file} (absolute: {session_file.absolute()})")
            logger.info(f"Token directory contents: {list(token_dir.glob('*'))}")
            
            if not session_file.exists():
                logger.error(f"Token file not found: {session_file}")
                return {
                    "status": "error",
                    "message": "Your Garmin session has expired. Please reconnect your Garmin account.",
                    "code": "EXPIRED_SESSION"
                }
            
            # Initialize the Garmin client with session file
            logger.info(f"Initializing Garmin client with session file: {session_file}")
            client = Garmin()
            client.session_data_path = str(session_file)
            
            # Try to login with the existing session
            try:
                logger.info("Logging in with saved session...")
                client.login()
                logger.info("Session authentication successful!")
            except Exception as e:
                logger.error(f"Session authentication failed: {e}")
                
                # Session auth failed, try direct auth again as last resort if password provided
                if password:
                    logger.info("Trying direct authentication as fallback...")
                    try:
                        client = Garmin(username, password)
                        client.login()
                        logger.info("Direct authentication successful!")
                    except Exception as auth_error:
                        logger.error(f"Direct authentication failed: {auth_error}")
                        return {
                            "status": "error",
                            "message": "Your Garmin credentials could not be validated. Please reconnect your account.",
                            "code": "AUTH_FAILED"
                        }
                else:
                    return {
                        "status": "error",
                        "message": "Your Garmin session has expired. Please reconnect your Garmin account.",
                        "code": "EXPIRED_SESSION"
                    }

        # If we've made it this far, we have a logged-in client
        logger.info("Authentication successful, fetching data...")

        # Fetch health data for the specified date
        logger.info(f"Fetching health data for date: {date_str}")
        
        try:
            # Convert string date to datetime object for API calls that need it
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
            
            # Get sleep data
            logger.info("Getting sleep data...")
            sleep_data = client.get_sleep_data(date_obj.isoformat())
            
            # Get body battery data
            logger.info("Getting body battery data...")
            body_battery = None
            body_battery_value = None
            
            # Get the user summary which contains the most recent body battery value
            try:
                logger.info("Getting body battery from user summary data...")
                user_metrics = client.get_user_summary(date_str)
                
                if user_metrics and isinstance(user_metrics, dict):
                    # Get the most recent body battery value
                    if 'bodyBatteryMostRecentValue' in user_metrics:
                        body_battery_value = user_metrics['bodyBatteryMostRecentValue']
                        logger.info(f"Found current body battery value: {body_battery_value}")
                    elif 'bodyBattery' in user_metrics:
                        body_battery_value = user_metrics['bodyBattery']
                        logger.info(f"Found body battery value: {body_battery_value}")
                    
                    # Also log other body battery fields for reference
                    body_battery_fields = {k: v for k, v in user_metrics.items() if 'bodyBattery' in k}
                    if body_battery_fields:
                        logger.info(f"All body battery fields in user metrics: {body_battery_fields}")
                
            except Exception as e:
                logger.warning(f"Error getting body battery from user summary: {e}")
            
            # If no value found yet, try fallback methods
            if body_battery_value is None:
                try:
                    # Approach 1: Using body_battery with a date range
                    yesterday = date_obj - timedelta(days=1)
                    logger.info(f"Fallback: Using body_battery with date range from {yesterday.isoformat()} to {date_obj.isoformat()}")
                    body_battery = client.get_body_battery(yesterday.isoformat(), date_obj.isoformat())
                    
                    if isinstance(body_battery, list) and len(body_battery) > 0:
                        # Try to extract the latest body battery value from the data
                        if isinstance(body_battery[0], dict) and 'mostRecent' in body_battery[0]:
                            body_battery_value = body_battery[0]['mostRecent']
                            logger.info(f"Found most recent body battery in body_battery data: {body_battery_value}")
                        elif isinstance(body_battery[0], dict) and 'bodyBatteryMostRecentValue' in body_battery[0]:
                            body_battery_value = body_battery[0]['bodyBatteryMostRecentValue']
                            logger.info(f"Found most recent body battery value: {body_battery_value}")
                        
                        # As a last resort, calculate from charged/drained values
                        if body_battery_value is None and isinstance(body_battery[0], dict) and ('charged' in body_battery[0] and 'drained' in body_battery[0]):
                            # Get current time as proportion of day
                            now = datetime.now()
                            proportion_of_day = (now.hour * 60 + now.minute) / (24 * 60)
                            
                            charged = body_battery[0].get('charged', 0)
                            drained = body_battery[0].get('drained', 0)
                            
                            # Calculate body battery value
                            calculated_value = int(max(5, min(100, 100 - drained + charged)))
                            logger.info(f"Calculated body battery as fallback: {calculated_value}")
                            
                            # Only use calculated value if we couldn't find a real one
                            if body_battery_value is None:
                                body_battery_value = calculated_value
                                logger.warning("Using calculated body battery as fallback - this is not the real value")
                except Exception as e:
                    logger.error(f"Error processing body battery data: {e}")
            
            # Get stress data
            logger.info("Getting stress data...")
            stress_data = client.get_stress_data(date_str)
            
            # Get heart rate data
            logger.info("Getting heart rate data...")
            heart_rate = client.get_heart_rates(date_str)
            
            # Get HRV data
            logger.info("Getting HRV data...")
            hrv_data = client.get_hrv_data(date_str)
            
            # Get stats data (includes resting heart rate)
            logger.info("Getting stats data...")
            stats = client.get_stats(date_str)
            
            # Process sleep data
            sleep_seconds = None
            sleep_score = None
            
            if sleep_data:
                # Extract sleep duration
                if 'dailySleepDTO' in sleep_data:
                    sleep_seconds = sleep_data['dailySleepDTO'].get('sleepTimeSeconds', None)
                    logger.info(f"Sleep time: {sleep_seconds/3600 if sleep_seconds else 0} hours")
                
                # Extract sleep score (different formats)
                if 'sleepScores' in sleep_data and sleep_data['sleepScores']:
                    sleep_score = sleep_data['sleepScores'][0].get('value', None)
                    logger.info(f"Sleep score: {sleep_score}")
                elif 'dailySleepDTO' in sleep_data and 'sleepScore' in sleep_data['dailySleepDTO']:
                    sleep_score = sleep_data['dailySleepDTO'].get('sleepScore', None)
                    logger.info(f"Sleep score from dailySleepDTO: {sleep_score}")
            
            # Process stress level
            avg_stress = None
            if stress_data and 'avgStressLevel' in stress_data:
                avg_stress = stress_data.get('avgStressLevel')
                logger.info(f"Average stress level: {avg_stress}")
            
            # Process resting heart rate
            resting_hr = None
            if stats and 'restingHeartRate' in stats:
                resting_hr = stats['restingHeartRate']
                logger.info(f"Resting heart rate: {resting_hr}")
            
            # Process HRV
            hrv_value = None
            if hrv_data and 'hrvSummary' in hrv_data:
                hrv_value = hrv_data['hrvSummary'].get('weeklyAvg')
                logger.info(f"HRV weekly average: {hrv_value}")
            
            # Calculate training readiness
            training_readiness = None
            valid_metrics = [m for m in [sleep_seconds, body_battery_value, avg_stress, resting_hr, hrv_value] if m is not None]
            
            if len(valid_metrics) >= 3:
                # Simple algorithm to calculate training readiness
                readiness_score = 0
                metrics_count = 0
                
                # Sleep contribution (0-30 points)
                if sleep_seconds:
                    sleep_hours = sleep_seconds / 3600
                    if sleep_hours >= 7 and sleep_hours <= 9:
                        readiness_score += 30
                    elif sleep_hours >= 6:
                        readiness_score += 20
                    elif sleep_hours >= 5:
                        readiness_score += 10
                    else:
                        readiness_score += 5
                    metrics_count += 1
                
                # Body Battery contribution (0-25 points)
                if body_battery_value:
                    readiness_score += min(25, body_battery_value * 0.25)
                    metrics_count += 1
                
                # Stress contribution (0-15 points)
                if avg_stress:
                    readiness_score += 15 * (1 - (avg_stress / 100))
                    metrics_count += 1
                
                # Resting HR contribution (0-15 points)
                if resting_hr:
                    readiness_score += 15 * max(0, min(1, (90 - resting_hr) / 50))
                    metrics_count += 1
                
                # HRV contribution (0-15 points)
                if hrv_value:
                    readiness_score += 15 * max(0, min(1, (hrv_value - 20) / 60))
                    metrics_count += 1
                
                # Calculate final score
                if metrics_count > 0:
                    # Scale based on available metrics
                    max_possible = 30 + 25 + 15 + 15 + 15
                    scaling_factor = max_possible / (metrics_count * (max_possible / 5))
                    training_readiness = int(min(100, round(readiness_score * scaling_factor)))
                    logger.info(f"Calculated training readiness: {training_readiness}")
            
            # Count valid metrics
            valid_metrics_count = sum(1 for x in [sleep_seconds, sleep_score, body_battery_value, avg_stress, resting_hr, hrv_value] if x is not None)
            logger.info(f"Found {valid_metrics_count} valid metrics")
            
            # Return the processed data
            return {
                "status": "success",
                "data": {
                    "date": date_str,
                    "hasData": valid_metrics_count > 0,
                    "validMetricsCount": valid_metrics_count,
                    "sleep": {
                        "sleepSeconds": sleep_seconds,
                        "sleepScore": sleep_score
                    },
                    "bodyBattery": body_battery_value,
                    "avgStress": avg_stress,
                    "restingHeartRate": resting_hr,
                    "hrv": {
                        "weeklyAvg": hrv_value
                    },
                    "trainingReadiness": training_readiness
                }
            }
            
        except GarminConnectConnectionError as e:
            logger.error(f"Garmin Connect connection error: {e}")
            return {
                "status": "error",
                "message": f"Connection error: {str(e)}",
                "error_type": "connection_error"
            }
        except GarminConnectAuthenticationError as e:
            logger.error(f"Garmin Connect authentication error: {e}")
            return {
                "status": "error",
                "message": f"Authentication error: {str(e)}",
                "error_type": "auth_error"
            }
        except GarminConnectTooManyRequestsError as e:
            logger.error(f"Garmin Connect too many requests error: {e}")
            return {
                "status": "error",
                "message": f"Too many requests: {str(e)}. Please try again later.",
                "error_type": "rate_limit"
            }
        except Exception as e:
            logger.error(f"Unknown error: {e}")
            return {
                "status": "error",
                "message": f"Unknown error: {str(e)}",
                "error_type": "unknown_error"
            }
            
    except Exception as e:
        logger.error(f"Unexpected error in sync_data: {e}")
        return {
            "status": "error", 
            "message": f"Unexpected error: {str(e)}",
            "error_type": "unexpected_error"
        }


def main():
    """Main function to handle CLI usage."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "status": "error",
            "message": "Usage: python garmin_direct_sync.py <username> [date] [password]"
        }))
        sys.exit(1)
    
    username = sys.argv[1]
    date_str = sys.argv[2] if len(sys.argv) > 2 else None
    password = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        result = sync_data(username, date_str, password)
        print(json.dumps(result))
    except Exception as e:
        logger.error(f"Unexpected error in sync_data: {e}")
        error_result = {
            "status": "error",
            "message": f"Unexpected error: {str(e)}",
            "error_type": "unexpected"
        }
        print(json.dumps(error_result))


if __name__ == "__main__":
    main() 