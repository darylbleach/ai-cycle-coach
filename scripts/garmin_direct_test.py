#!/usr/bin/env python3
# Direct Garmin Connect test script
import os
import garth
import requests
import traceback

# Set your Garmin credentials directly in the script
# (Make sure to delete these after testing)
GARMIN_EMAIL = "darylbleach@me.com"
GARMIN_PASSWORD = ""  # Add your password here temporarily

print("Starting direct Garmin test script")

# Basic connectivity test
try:
    print("Testing connection to Garmin Connect...")
    response = requests.get("https://connect.garmin.com", timeout=10)
    print(f"Connection status: {response.status_code}")
except Exception as e:
    print(f"Connection error: {str(e)}")

if not GARMIN_PASSWORD:
    print("ERROR: Please edit this script to add your password before running")
    exit(1)

print(f"Attempting to authenticate user: {GARMIN_EMAIL}")
try:
    # Try with domain parameter
    print("Trying with domain parameter...")
    client = garth.Client(domain="garmin.com")
    client.login(GARMIN_EMAIL, GARMIN_PASSWORD)
    print("Authentication successful!")
    
    # Test that we can access data
    print("Attempting to get user profile...")
    profile = client.profile
    print(f"User profile retrieved - Name: {profile.get('firstName', 'Unknown')} {profile.get('lastName', 'Unknown')}")
    
except Exception as e:
    print(f"Authentication error: {str(e)}")
    print(f"Detailed error: {traceback.format_exc()}")
    print("Possible causes:")
    print("1. Incorrect username or password")
    print("2. Two-factor authentication is enabled")
    print("3. Garmin API changes or temporary outage")
    
    # Try alternative approach
    try:
        print("\nTrying alternative approach...")
        from garminconnect import Garmin
        client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
        client.login()
        print("Alternative approach successful!")
    except Exception as alt_e:
        print(f"Alternative approach failed: {str(alt_e)}")

print("\nTest completed - Remember to remove your password from this script!") 