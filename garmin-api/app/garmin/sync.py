import logging
import garth
from garminconnect import Garmin
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import traceback

from .auth import load_token, authenticate
from ..config import settings

# Setup logger
logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

def safe_get_data(data_type: str, getter_func, default=None):
    """Safely get data from Garmin Connect API with error handling
    
    Args:
        data_type: Type of data being requested (for logging)
        getter_func: Function to call to get the data
        default: Default value to return if the call fails
        
    Returns:
        The data from the API call or the default value if it fails
    """
    try:
        logger.debug(f"Retrieving {data_type} data")
        data = getter_func()
        logger.debug(f"Successfully retrieved {data_type} data")
        
        # Debug log a sample of the data (truncated for large responses)
        if logger.level <= logging.DEBUG:
            data_sample = str(data)[:500] + "..." if len(str(data)) > 500 else str(data)
            logger.debug(f"Sample {data_type} data: {data_sample}")
        
        return data
    except Exception as e:
        logger.error(f"Error retrieving {data_type} data: {str(e)}")
        logger.debug(f"Traceback for {data_type}: {traceback.format_exc()}")
        return default

async def sync_health_data(username: str, date_str: Optional[str] = None) -> Dict[str, Any]:
    """Sync health data from Garmin Connect
    
    Args:
        username: Garmin Connect username (email)
        date_str: Date to retrieve data for in YYYY-MM-DD format (defaults to today)
        
    Returns:
        Dictionary with health data and status
    """
    try:
        # Authenticate and get client
        token_data = load_token(username)
        if not token_data:
            logger.error(f"No authentication token found for user {username}")
            return {"status": "error", "message": "Authentication required"}
        
        # Initialize garth and Garmin Connect client
        garth.resume(token_data)
        client = Garmin(session_data=token_data)

        # Determine the date to retrieve data for
        if date_str:
            try_date = date_str
        else:
            try_date = datetime.now().strftime("%Y-%m-%d")
        
        logger.info(f"Syncing data for user {username} and date {try_date}")
        
        # Get sleep data
        sleep_data = safe_get_data('sleep', lambda: client.get_sleep_data(try_date))
        sleep_seconds = None
        sleep_score = None
        
        # Process sleep data if available
        if sleep_data:
            # Process sleep data to extract metrics
            if 'dailySleepDTO' in sleep_data:
                sleep_seconds = sleep_data['dailySleepDTO'].get('sleepTimeSeconds', None)
                
                # Try to find sleep score in multiple locations
                if 'sleepScore' in sleep_data['dailySleepDTO']:
                    sleep_score = sleep_data['dailySleepDTO'].get('sleepScore', None)
                    logger.debug(f"Found sleep score in dailySleepDTO: {sleep_score}")
                elif 'wellnessEpochDataQualityDTO' in sleep_data['dailySleepDTO']:
                    sleep_score = sleep_data['dailySleepDTO']['wellnessEpochDataQualityDTO'].get('qualityValue', None)
                    logger.debug(f"Found sleep score in quality DTO: {sleep_score}")
            
            # Try alternative sleep score formats
            if sleep_score is None and 'sleepScores' in sleep_data:
                if sleep_data['sleepScores'] and len(sleep_data['sleepScores']) > 0:
                    sleep_score = sleep_data['sleepScores'][0].get('value', None)
                    logger.debug(f"Found sleep score in sleepScores: {sleep_score}")
            
            # Try overall sleep quality
            if sleep_score is None and 'sleepQuality' in sleep_data:
                quality = sleep_data['sleepQuality']
                if isinstance(quality, (int, float)) and quality > 0:
                    # Convert to 0-100 scale if needed
                    sleep_score = quality if quality <= 100 else quality/10
                    logger.debug(f"Converted sleep quality to score: {sleep_score}")
            
            # Try to extract sleep seconds from other formats if not found
            if sleep_seconds is None and 'sleepTimeSeconds' in sleep_data:
                sleep_seconds = sleep_data.get('sleepTimeSeconds', None)
            
            # Log sleep time if available
            if sleep_seconds:
                sleep_hours = sleep_seconds / 3600
                logger.debug(f"Sleep time: {sleep_seconds} seconds = {sleep_hours:.2f} hours")
        
        # Get body battery data
        body_battery_data = safe_get_data('body battery', lambda: client.get_body_battery(try_date))
        body_battery_value = None
        
        # Process body battery data if available
        if body_battery_data and len(body_battery_data) > 0:
            # Extract the most recent body battery value
            if 'bodyBatteryValuesArray' in body_battery_data[0] and body_battery_data[0]['bodyBatteryValuesArray']:
                battery_values = body_battery_data[0]['bodyBatteryValuesArray']
                if battery_values:
                    body_battery_value = battery_values[-1][1]  # Get the last value
                    logger.debug(f"Found body battery most recent value: {body_battery_value}")
        
        # Get stress data
        stress_data = safe_get_data('stress', lambda: client.get_stress_data(try_date))
        avg_stress = None
        
        # Process stress data if available
        if stress_data:
            avg_stress = stress_data.get('avgStressLevel', None)
            logger.debug(f"Found avgStressLevel: {avg_stress}")
        
        # Get resting heart rate
        rhr_data = safe_get_data('resting heart rate', lambda: client.get_rhr_day(try_date))
        resting_hr = None
        
        # Process resting heart rate data if available
        if rhr_data and 'allMetrics' in rhr_data and 'metricsMap' in rhr_data['allMetrics']:
            metrics_map = rhr_data['allMetrics']['metricsMap']
            if 'WELLNESS_RESTING_HEART_RATE' in metrics_map and metrics_map['WELLNESS_RESTING_HEART_RATE']:
                resting_hr = metrics_map['WELLNESS_RESTING_HEART_RATE'][0].get('value', None)
                logger.debug(f"Found resting heart rate value: {resting_hr}")
        
        # Get HRV data
        hrv_data = safe_get_data('HRV', lambda: client.get_hrv_data(try_date))
        hrv_weekly_avg = None
        
        # Process HRV data if available
        if hrv_data and 'hrvSummary' in hrv_data:
            hrv_weekly_avg = hrv_data['hrvSummary'].get('weeklyAvg', None)
            logger.debug(f"Found HRV weekly average: {hrv_weekly_avg}")
        
        # Get VO2max data (NOT showing in the dashboard)
        vo2max_value = None
        
        # Calculate training readiness score based on available metrics
        training_readiness = None
        valid_metrics = 0
        readiness_score = 0
        
        # Only calculate if we have at least 3 valid metrics
        if [sleep_seconds, body_battery_value, avg_stress, resting_hr, hrv_weekly_avg].count(None) <= 2:
            # Sleep contribution (0-30 points)
            if sleep_seconds:
                sleep_hours = sleep_seconds / 3600
                # Optimal sleep is 7-9 hours
                if sleep_hours >= 7 and sleep_hours <= 9:
                    sleep_points = 30
                elif sleep_hours >= 6 and sleep_hours < 7:
                    sleep_points = 20
                elif sleep_hours >= 5 and sleep_hours < 6:
                    sleep_points = 10
                else:
                    sleep_points = 5
                readiness_score += sleep_points
                valid_metrics += 1
            
            # Body Battery contribution (0-25 points)
            if body_battery_value:
                # Higher body battery = better readiness
                body_battery_points = min(25, body_battery_value * 0.25)
                readiness_score += body_battery_points
                valid_metrics += 1
            
            # Stress contribution (0-15 points)
            if avg_stress:
                # Lower stress = better readiness (0-100 scale, inverted)
                stress_points = 15 * (1 - (avg_stress / 100))
                readiness_score += stress_points
                valid_metrics += 1
            
            # Resting HR contribution (0-15 points)
            if resting_hr:
                # Assuming normal resting HR range is 40-90 bpm
                # Lower RHR generally indicates better fitness/recovery
                # Normalize to 0-15 scale (inverted)
                rhr_points = 15 * max(0, min(1, (90 - resting_hr) / 50))
                readiness_score += rhr_points
                valid_metrics += 1
            
            # HRV contribution (0-15 points)
            if hrv_weekly_avg:
                # Higher HRV generally indicates better recovery
                # Assuming HRV range of 20-80 ms
                hrv_points = 15 * max(0, min(1, (hrv_weekly_avg - 20) / 60))
                readiness_score += hrv_points
                valid_metrics += 1
            
            # Calculate final score if we have enough metrics
            if valid_metrics >= 3:
                # Normalize to account for missing metrics
                max_possible = 30 + 25 + 15 + 15 + 15  # 100 total
                # Scale based on which metrics we have
                scaling_factor = max_possible / (valid_metrics * (max_possible / 5))
                training_readiness = int(min(100, readiness_score * scaling_factor))
                logger.debug(f"Calculated training readiness score: {training_readiness}")
        
        # Count number of valid metrics
        valid_metrics_count = sum(1 for x in [sleep_seconds, body_battery_value, avg_stress, resting_hr, hrv_weekly_avg] if x is not None)
        logger.info(f"Found {valid_metrics_count}/5 valid metrics for date {try_date}")
        
        # Determine if we have valid data
        has_valid_data = valid_metrics_count > 0
        
        # Prepare health data response
        health_data = {
            "sleep": {
                "sleepSeconds": sleep_seconds,
                "sleepScore": sleep_score
            },
            "bodyBattery": body_battery_value,
            "avgStress": avg_stress,
            "restingHeartRate": resting_hr,
            "hrv": {
                "weeklyAvg": hrv_weekly_avg
            },
            "vo2max": vo2max_value,  # Will be None, as we're not retrieving it
            "trainingReadiness": training_readiness,
            "date": try_date,
            "hasData": has_valid_data,
            "validMetricsCount": valid_metrics_count
        }
        
        logger.info(f"Successfully processed health data for date {try_date}")
        
        return {
            "status": "success",
            "data": health_data
        }
    
    except Exception as e:
        logger.error(f"Error syncing health data: {str(e)}")
        logger.debug(traceback.format_exc())
        return {
            "status": "error",
            "message": str(e)
        } 