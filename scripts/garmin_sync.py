#!/usr/bin/env python3
"""
Garmin Data Sync Script
-----------------------
This script synchronizes health data from Garmin Connect.
"""

import os
import sys
import json
import logging
from datetime import datetime, date
from typing import Dict, Any, Optional

# Third-party imports
import garth
from garminconnect import Garmin

# Import our authentication module
from garmin_auth import load_token

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def safe_get_data(data_type: str, getter_func, default=None):
    """Safely get data from Garmin Connect."""
    try:
        data = getter_func()
        return data
    except Exception as e:
        logger.warning(f"Error getting {data_type}: {e}")
        return default

async def sync_health_data(username: str, date_str: Optional[str] = None) -> Dict[str, Any]:
    """Synchronize health data from Garmin Connect."""
    try:
        # Load token
        token = load_token(username)
        if not token:
            return {"success": False, "message": "No valid token found for user"}
        
        # Initialize Garmin client with token
        garth.client.loads(token)
        client = Garmin(token)
        
        # Determine date
        if date_str:
            try:
                sync_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return {"success": False, "message": f"Invalid date format: {date_str}. Use YYYY-MM-DD."}
        else:
            sync_date = date.today()
        
        date_str = sync_date.strftime("%Y-%m-%d")
        logger.info(f"Syncing data for {username} on {date_str}")
        
        # Get sleep data
        sleep_data = safe_get_data("sleep data", 
            lambda: client.get_sleep_data(sync_date.isoformat()))
        
        # Get body battery
        body_battery = safe_get_data("body battery", 
            lambda: client.get_body_battery(date_str))
        
        # Get stress data
        stress_data = safe_get_data("stress data", 
            lambda: client.get_stress_data(date_str))
        
        # Get heart rate
        heart_rate = safe_get_data("heart rate", 
            lambda: client.get_heart_rates(date_str))
        
        # Get HRV
        hrv_data = safe_get_data("HRV", 
            lambda: client.get_hrv_data(date_str))
        
        # Get user stats
        stats = safe_get_data("user stats", 
            lambda: client.get_stats(date_str))
        
        # Process sleep score
        sleep_score = None
        if sleep_data and "sleepScores" in sleep_data and sleep_data["sleepScores"]:
            sleep_score = sleep_data["sleepScores"][0].get("value")
        
        # Process sleep duration
        sleep_duration_seconds = None
        if sleep_data and "dailySleepDTO" in sleep_data and sleep_data["dailySleepDTO"]:
            sleep_duration_seconds = sleep_data["dailySleepDTO"].get("sleepTimeSeconds", 0)
        
        # Process resting heart rate
        resting_heart_rate = None
        if stats and "restingHeartRate" in stats:
            resting_heart_rate = stats["restingHeartRate"]
        
        # Process body battery
        min_body_battery = None
        max_body_battery = None
        if body_battery and len(body_battery) > 0:
            battery_values = [item.get("value", 0) for item in body_battery if "value" in item]
            if battery_values:
                min_body_battery = min(battery_values)
                max_body_battery = max(battery_values)
        
        # Process stress
        avg_stress = None
        max_stress = None
        if stress_data and "avgStressLevel" in stress_data:
            avg_stress = stress_data["avgStressLevel"]
            max_stress = stress_data.get("maxStressLevel")
        
        # Process HRV
        hrv_summary = None
        if hrv_data and "hrvSummary" in hrv_data:
            hrv_summary = hrv_data["hrvSummary"].get("weeklyAvg")
        
        # Compile health metrics
        health_metrics = {
            "date": date_str,
            "sleepScore": sleep_score,
            "sleepDurationSeconds": sleep_duration_seconds,
            "restingHeartRate": resting_heart_rate,
            "minBodyBattery": min_body_battery,
            "maxBodyBattery": max_body_battery,
            "avgStress": avg_stress,
            "maxStress": max_stress,
            "hrvSummary": hrv_summary
        }
        
        return {
            "success": True,
            "message": f"Successfully synced data for {username} on {date_str}",
            "data": health_metrics
        }
        
    except Exception as e:
        logger.error(f"Error syncing health data: {e}")
        return {"success": False, "message": f"Error syncing health data: {str(e)}"}

def main():
    """Main function to handle CLI usage."""
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "message": "Username required"}))
        sys.exit(1)
    
    username = sys.argv[1]
    date_str = sys.argv[2] if len(sys.argv) > 2 else None
    
    # This is a synchronous version for CLI use
    # In real usage, you would use asyncio.run(sync_health_data(...))
    import asyncio
    result = asyncio.run(sync_health_data(username, date_str))
    print(json.dumps(result))

if __name__ == "__main__":
    main() 