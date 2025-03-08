#!/usr/bin/env python3
# scripts/garmin_test_file.py - Tests Garmin authentication by reading credentials from a file
import sys
import os
import requests
import json
from garminconnect import Garmin

def test_garmin_auth():
    # Check if the credentials file exists
    creds_file = 'garmin_creds.txt'
    if not os.path.exists(creds_file):
        # Create the credentials file template
        with open(creds_file, 'w') as f:
            f.write("your-garmin-email@me.com\n")
            f.write("your-garmin-password\n")
        
        print(f"I've created a file named '{creds_file}' in the current directory.")
        print("Please edit this file to add your Garmin email and password, each on their own line.")
        print("After editing, run this script again.")
        return
    
    # Read credentials from file
    try:
        with open(creds_file, 'r') as f:
            lines = f.readlines()
            if len(lines) < 2:
                print("Error: The credentials file should contain at least 2 lines (email and password)")
                return
            
            username = lines[0].strip()
            password = lines[1].strip()
            
            if username == "your-garmin-email@example.com" or password == "your-garmin-password":
                print("Error: Please edit the credentials file with your actual Garmin email and password")
                return
    except Exception as e:
        print(f"Error reading credentials file: {str(e)}")
        return
    
    print(f"Checking Garmin account: {username}")
    print("Testing connectivity to Garmin servers...")
    
    # First, check if we can reach Garmin's servers
    try:
        resp = requests.get("https://connect.garmin.com", timeout=10)
        print(f"Connected to Garmin servers: Status {resp.status_code}")
    except Exception as e:
        print(f"Failed to connect to Garmin servers: {str(e)}")
        return
    
    # Now try to authenticate
    try:
        print("\nAttempting authentication...")
        client = Garmin(username, password)
        client.login()
        print("✅ Authentication successful!")
        
        # Try to get user profile
        try:
            print("\nRetrieving user profile...")
            profile = client.get_user_profile()
            print(f"Profile retrieved for: {profile.get('firstName', 'Unknown')} {profile.get('lastName', 'Unknown')}")
        except Exception as profile_error:
            print(f"❌ Couldn't retrieve profile: {str(profile_error)}")
        
        # Try to get some health data
        try:
            print("\nRetrieving health data (to test data access)...")
            today = client.get_heart_rates(client.today)
            print(f"Health data retrieved - Heart rate samples: {len(today.get('heartRateValues', []))} samples")
        except Exception as health_error:
            print(f"❌ Couldn't retrieve health data: {str(health_error)}")
        
    except Exception as e:
        error_message = str(e)
        print(f"❌ Authentication failed: {error_message}")
        
        # Check for common issues
        if "401" in error_message and "Unauthorized" in error_message:
            print("\n🔍 DIAGNOSIS: 401 Unauthorized error")
            print("This typically means one of the following:")
            print("  - Incorrect username or password")
            print("  - Multi-Factor Authentication (MFA/2FA) is enabled on your Garmin account")
            print("  - Your Garmin account may be temporarily locked due to too many login attempts")
            
            print("\n✅ SOLUTION:")
            print("1. Double-check your username and password")
            print("2. Log in to Garmin Connect manually at https://connect.garmin.com")
            print("3. If you have MFA enabled, disable it temporarily in your Garmin account settings")
            print("4. If your account is locked, wait 30 minutes and try again")
        
        elif "multi" in error_message.lower() and ("factor" in error_message.lower() or "mfa" in error_message.lower() or "2fa" in error_message.lower()):
            print("\n🔍 DIAGNOSIS: Multi-Factor Authentication Detected")
            print("Your Garmin account has MFA/2FA enabled, which prevents API access.")
            
            print("\n✅ SOLUTION:")
            print("1. Log in to Garmin Connect at https://connect.garmin.com")
            print("2. Go to your account settings")
            print("3. Disable MFA/2FA temporarily")
            print("4. Connect the app to your Garmin account")
            print("5. You can re-enable MFA/2FA afterward if desired")
        
        else:
            print("\n🔍 DIAGNOSIS: Unknown authentication error")
            print("This may be related to:")
            print("  - Garmin API changes or maintenance")
            print("  - Network connectivity issues")
            print("  - Account-specific restrictions")
            
            print("\n✅ RECOMMENDED STEPS:")
            print("1. Try logging in to Garmin Connect manually at https://connect.garmin.com")
            print("2. Check if your account has any alerts or notices")
            print("3. Try again later as it might be a temporary issue")
    
    # Clean up the credentials file for security
    print("\nSecurity notice: Cleaning up credentials file...")
    try:
        os.remove(creds_file)
        print(f"✅ Credentials file '{creds_file}' has been deleted for security.")
    except Exception as e:
        print(f"Warning: Could not delete credentials file: {str(e)}")
        print("Please delete it manually for security.")

if __name__ == "__main__":
    test_garmin_auth() 