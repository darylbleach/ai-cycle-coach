#!/usr/bin/env python3
"""
Direct Garmin Sync Script for Cron Jobs
---------------------------------------
This script is designed to be called directly from cron jobs to sync Garmin health data.
It handles authentication, data retrieval, and returns structured data that can be used by the application.

Usage: garmin_direct_sync.py <email> <token_path> <date>
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Third-party imports - handle import errors gracefully
try:
    from garminconnect import Garmin
    import garth
except ImportError:
    print(json.dumps({
        "status": "error",
        "error": "Missing required libraries. Please install garminconnect and garth."
    }))
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def sync_garmin_data(email, token_path, date_str=None):
    """Sync health data from Garmin Connect for a specific date."""
    try:
        # Determine the date to sync
        if date_str:
            try:
                sync_date = datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                logger.error(f"Invalid date format: {date_str}. Using today's date.")
                sync_date = datetime.now()
        else:
            sync_date = datetime.now()
        
        formatted_date = sync_date.strftime("%Y-%m-%d")
        logger.info(f"Syncing data for {email} on {formatted_date}")
        
        # Create token path if it doesn't exist
        token_dir = Path(token_path)
        token_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine token file path
        token_file = token_dir / f"{email}.json"
        
        # Initialize API client
        client = None
        
        # First try to use garth for authentication (more modern approach)
        if os.path.exists(token_file):
            try:
                with open(token_file, 'r') as f:
                    token_data = json.load(f)
                
                # Check if we have garth token data
                if 'garth_token' in token_data:
                    logger.info(f"Found garth token for {email}")
                    garth_token = token_data.get('garth_token')
                    garth.resume(garth_token)
                    client = Garmin(email)
                    client.garth = garth
                    logger.info("Using garth client for API access")
            except Exception as e:
                logger.error(f"Error loading garth token: {e}")
        
        # Fall back to traditional login if garth failed
        if client is None:
            logger.info(f"Using traditional login for {email}")
            client = Garmin(email)
            client.login(tokenstore=str(token_file))
            logger.info("Successfully logged in with traditional method")
        
        # Retrieve health data
        data = {}
        valid_metrics_count = 0
        has_data = False
        
        try:
            # Get sleep data
            logger.info("Getting sleep data...")
            sleep_data = client.get_sleep_data(formatted_date)
            
            if sleep_data and 'dailySleepDTO' in sleep_data:
                daily_sleep = sleep_data['dailySleepDTO']
                sleep_seconds = daily_sleep.get('sleepTimeSeconds', 0)
                sleep_score = daily_sleep.get('sleepScoreDTO', {}).get('value')
                
                if sleep_seconds > 0:
                    data['sleep'] = {
                        'sleepSeconds': sleep_seconds,
                        'sleepScore': sleep_score
                    }
                    valid_metrics_count += 1
                    has_data = True
                    logger.info(f"Sleep time: {sleep_seconds / 3600:.2f} hours")
            
            # Get body battery
            try:
                logger.info("Getting body battery data...")
                body_battery = client.get_body_battery(formatted_date)
                
                if body_battery and len(body_battery) > 0:
                    # Get the value at the end of the day or latest available
                    battery_values = [item.get('value', 0) for item in body_battery if 'value' in item]
                    if battery_values:
                        data['bodyBattery'] = battery_values[-1]
                        valid_metrics_count += 1
                        logger.info(f"Body battery: {data['bodyBattery']}")
            except Exception as e:
                logger.error(f"Error getting body battery: {e}")
            
            # Get stress data
            try:
                logger.info("Getting stress data...")
                stress_data = client.get_stress_data(formatted_date)
                
                if stress_data and 'avgStressLevel' in stress_data:
                    avg_stress = stress_data['avgStressLevel']
                    if avg_stress > 0:
                        data['avgStress'] = avg_stress
                        valid_metrics_count += 1
                        logger.info(f"Average stress level: {avg_stress}")
            except Exception as e:
                logger.error(f"Error getting stress data: {e}")
            
            # Get heart rate data
            try:
                logger.info("Getting heart rate data...")
                heart_rate_data = client.get_rhr_day(formatted_date)
                
                if heart_rate_data and 'restingHeartRate' in heart_rate_data:
                    resting_hr = heart_rate_data['restingHeartRate']
                    if resting_hr > 0:
                        data['restingHeartRate'] = resting_hr
                        valid_metrics_count += 1
                        logger.info(f"Resting heart rate: {resting_hr}")
            except Exception as e:
                logger.error(f"Error getting heart rate data: {e}")
            
            # Get HRV data
            try:
                logger.info("Getting HRV data...")
                hrv_data = client.get_hrv_data(formatted_date)
                
                if hrv_data and 'hrvSummary' in hrv_data and hrv_data['hrvSummary']:
                    weekly_avg = hrv_data['hrvSummary'].get('weeklyAvg')
                    if weekly_avg:
                        data['hrv'] = {'weeklyAvg': weekly_avg}
                        valid_metrics_count += 1
                        logger.info(f"HRV weekly average: {weekly_avg}")
            except Exception as e:
                logger.error(f"Error getting HRV data: {e}")
            
            # Get stats data (includes VO2Max sometimes)
            try:
                logger.info("Getting stats data...")
                user_summary = client.get_user_summary(formatted_date)
                
                if user_summary:
                    vo2max = user_summary.get('vo2Max')
                    if vo2max:
                        data['vo2max'] = vo2max
                        valid_metrics_count += 1
                        logger.info(f"VO2 Max: {vo2max}")
            except Exception as e:
                logger.error(f"Error getting stats data: {e}")
            
            # Calculate training readiness (basic algorithm)
            if valid_metrics_count >= 3:
                try:
                    training_readiness = 0
                    metrics_used = 0
                    
                    # Sleep contributes up to 40 points
                    if 'sleep' in data:
                        sleep_hours = data['sleep']['sleepSeconds'] / 3600
                        sleep_score = min(max(0, (sleep_hours - 4) / 4 * 40), 40)
                        training_readiness += sleep_score
                        metrics_used += 1
                    
                    # Resting HR contributes up to 20 points (lower is better)
                    if 'restingHeartRate' in data:
                        rhr = data['restingHeartRate']
                        rhr_score = max(0, 20 - (rhr - 40) / 40 * 20)
                        training_readiness += rhr_score
                        metrics_used += 1
                    
                    # Stress contributes up to 20 points (lower is better)
                    if 'avgStress' in data:
                        stress = data['avgStress']
                        stress_score = max(0, 20 - stress / 100 * 20)
                        training_readiness += stress_score
                        metrics_used += 1
                    
                    # HRV contributes up to 20 points (higher is better)
                    if 'hrv' in data and 'weeklyAvg' in data['hrv']:
                        hrv = data['hrv']['weeklyAvg']
                        hrv_score = min(max(0, hrv / 100 * 20), 20)
                        training_readiness += hrv_score
                        metrics_used += 1
                    
                    # Normalize score based on metrics used
                    if metrics_used > 0:
                        training_readiness = int(training_readiness / metrics_used * 4)
                        data['trainingReadiness'] = training_readiness
                        valid_metrics_count += 1
                        logger.info(f"Calculated training readiness: {training_readiness}")
                except Exception as e:
                    logger.error(f"Error calculating training readiness: {e}")
        
        except Exception as e:
            logger.error(f"Error retrieving health data: {e}")
            return {
                "status": "error",
                "error": f"Failed to retrieve health data: {str(e)}"
            }
        
        logger.info(f"Found {valid_metrics_count} valid metrics")
        
        # Prepare final response
        return {
            "status": "success",
            "date": formatted_date,
            "data": {
                "date": formatted_date,
                "hasData": has_data,
                "validMetricsCount": valid_metrics_count,
                **data
            }
        }
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {
            "status": "error",
            "error": f"Unexpected error: {str(e)}"
        }

def main():
    """Main function."""
    if len(sys.argv) < 3:
        print(json.dumps({
            "status": "error",
            "error": "Missing required arguments. Usage: garmin_direct_sync.py <email> <token_path> [date]"
        }))
        sys.exit(1)
    
    email = sys.argv[1]
    token_path = sys.argv[2]
    date_str = sys.argv[3] if len(sys.argv) > 3 else None
    
    result = sync_garmin_data(email, token_path, date_str)
    print(json.dumps(result))

if __name__ == "__main__":
    main() 