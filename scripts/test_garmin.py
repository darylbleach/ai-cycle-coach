#!/usr/bin/env python3
# Simple Garmin Connect test script
import sys
import os
import garth
import requests

print("Starting Garmin test script")

# Basic connectivity test
try:
    print("Testing connection to Garmin Connect...")
    response = requests.get("https://connect.garmin.com", timeout=10)
    print(f"Connection status: {response.status_code}")
except Exception as e:
    print(f"Connection error: {str(e)}")

# Try authentication if credentials provided
if len(sys.argv) == 3:
    username = sys.argv[1]
    password = sys.argv[2]
    
    print(f"Attempting to authenticate user: {username}")
    try:
        client = garth.Client()
        client.login(username, password)
        print("Authentication successful!")
        
        # Test that we can access data
        print("Attempting to get user profile...")
        profile = client.profile
        print(f"User profile retrieved - Name: {profile.get('firstName', 'Unknown')} {profile.get('lastName', 'Unknown')}")
        
    except Exception as e:
        print(f"Authentication error: {str(e)}")
        print("Possible causes:")
        print("1. Incorrect username or password")
        print("2. Two-factor authentication is enabled")
        print("3. Garmin API changes or temporary outage")
else:
    print("Usage: python test_garmin.py <username> <password>") 