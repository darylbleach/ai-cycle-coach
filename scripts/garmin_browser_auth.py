#!/usr/bin/env python3
# scripts/garmin_browser_auth.py - Mobile API authentication approach for Garmin
import sys
import json
import os
import traceback
import time
import requests
import random
import uuid
from urllib.parse import urlparse, parse_qs

# Mobile API auth endpoints
BASE_URL = "https://connectapi.garmin.com"
SSO_URL = "https://sso.garmin.com/sso"
LOGIN_URL = f"{SSO_URL}/signin"

# Browser-like user agents for mobile
MOBILE_USER_AGENTS = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    "Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
]

# Garmin Connect mobile API client credentials
CLIENT_ID = "GarminConnect" 
MOBILE_CLIENT_ID = "GARMIN_CONNECT_MOBILE"
MOBILE_CLIENT_SECRET = "N1RTy5FEshWerh9PJciLQAs5"

def authenticate(username, password, token_dir):
    try:
        print(f"Garmin Browser Auth: Starting authentication for user {username}", file=sys.stderr)
        
        # Check if token directory exists
        if not os.path.exists(token_dir):
            print(f"Garmin Browser Auth: Token directory {token_dir} does not exist", file=sys.stderr)
            os.makedirs(token_dir, exist_ok=True)
            print(f"Garmin Browser Auth: Created token directory {token_dir}", file=sys.stderr)
        
        # Create a session to maintain cookies
        session = requests.Session()
        
        # Set mobile headers
        user_agent = random.choice(MOBILE_USER_AGENTS)
        headers = {
            'User-Agent': user_agent,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://sso.garmin.com',
            'Connection': 'keep-alive',
            'Content-Type': 'application/json;charset=UTF-8',
        }
        session.headers.update(headers)
        
        print(f"Garmin Browser Auth: Using mobile API authentication approach", file=sys.stderr)
        
        # Step 1: Try mobile API direct authentication first
        try:
            print(f"Garmin Browser Auth: Attempting mobile API authentication", file=sys.stderr)
            
            # Mobile API auth parameters
            auth_data = {
                "id": username,
                "password": password
            }
            
            # Initial token request for mobile auth
            mobile_login_url = f"{BASE_URL}/auth/signin"
            
            print(f"Garmin Browser Auth: Requesting auth token from {mobile_login_url}", file=sys.stderr)
            
            login_headers = {
                'User-Agent': user_agent,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Referer': 'https://connect.garmin.com',
                'nk': 'NT',
                'di-backend': 'connectapi.garmin.com',
                'x-app-ver': '4.68.3.0',
                'x-app-id': 'com.garmin.connect.mobile'
            }
            
            response = session.post(
                mobile_login_url,
                headers=login_headers,
                json=auth_data,
                allow_redirects=False,
                timeout=30
            )
            
            print(f"Garmin Browser Auth: Mobile API auth response status: {response.status_code}", file=sys.stderr)
            
            if response.status_code == 200 or response.status_code == 204:
                print(f"Garmin Browser Auth: Mobile API auth successful!", file=sys.stderr)
                
                # Save cookies to a file
                cookie_file = os.path.join(token_dir, f"{username}_cookies.json")
                try:
                    print(f"Garmin Browser Auth: Saving cookies to {cookie_file}", file=sys.stderr)
                    cookie_dict = {cookie.name: cookie.value for cookie in session.cookies}
                    with open(cookie_file, 'w') as f:
                        json.dump({
                            "cookies": cookie_dict,
                            "timestamp": time.time(),
                            "user_agent": user_agent,
                            "auth_method": "mobile_api"
                        }, f)
                    print(f"Garmin Browser Auth: Cookies saved successfully", file=sys.stderr)
                except Exception as save_error:
                    print(f"Garmin Browser Auth: Warning - Could not save cookies: {str(save_error)}", file=sys.stderr)
                
                # Verify by trying to get user data
                try:
                    verify_url = f"{BASE_URL}/usersummary-service/profile/user"
                    verify_headers = {
                        'User-Agent': user_agent,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'di-backend': 'connectapi.garmin.com',
                        'x-app-ver': '4.68.3.0'
                    }
                    verify_response = session.get(verify_url, headers=verify_headers, timeout=30)
                    print(f"Garmin Browser Auth: Verification response status: {verify_response.status_code}", file=sys.stderr)
                    
                    if verify_response.status_code == 200:
                        try:
                            user_data = verify_response.json()
                            print(f"Garmin Browser Auth: Successfully verified user: {user_data.get('displayName', 'Unknown')}", file=sys.stderr)
                        except Exception as e:
                            print(f"Garmin Browser Auth: Could not parse user data: {str(e)}", file=sys.stderr)
                except Exception as e:
                    print(f"Garmin Browser Auth: Error verifying authentication: {str(e)}", file=sys.stderr)
                
                print(json.dumps({
                    "status": "success", 
                    "message": "Authentication successful using mobile API",
                }))
                sys.exit(0)
                
            print(f"Garmin Browser Auth: Mobile API auth failed, trying alternate method", file=sys.stderr)
            
        except Exception as e:
            print(f"Garmin Browser Auth: Error with mobile API auth: {str(e)}", file=sys.stderr)
            print(f"Garmin Browser Auth: Trying alternate authentication method", file=sys.stderr)
        
        # Step 2: Try REST API token authentication as fallback
        try:
            print(f"Garmin Browser Auth: Attempting token API authentication", file=sys.stderr)
            
            # Get device UUID for auth
            device_id = str(uuid.uuid4())
            print(f"Garmin Browser Auth: Generated device ID: {device_id}", file=sys.stderr)
            
            # Set headers for token request
            token_headers = {
                'User-Agent': user_agent,
                'Accept': 'application/json',
                'Accept-Language': 'en-US',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://sso.garmin.com',
                'Referer': 'https://sso.garmin.com/'
            }
            
            # Token API parameters
            token_params = {
                'clientId': MOBILE_CLIENT_ID,
                'clientSecret': MOBILE_CLIENT_SECRET,
                'code': '',  # Will be populated on response
                'grant_type': 'password',
                'username': username,
                'password': password,
                'scope': 'activity:read,activity:write,external:read,external:write,geu:read'
            }
            
            # Rest API token endpoint
            token_url = f"{SSO_URL}/oauth/token"
            
            print(f"Garmin Browser Auth: Requesting token from {token_url}", file=sys.stderr)
            token_response = session.post(
                token_url, 
                headers=token_headers,
                data=token_params,
                timeout=30
            )
            
            print(f"Garmin Browser Auth: Token API response status: {token_response.status_code}", file=sys.stderr)
            
            # Check if successful
            if token_response.status_code == 200:
                try:
                    token_data = token_response.json()
                    access_token = token_data.get('access_token')
                    refresh_token = token_data.get('refresh_token')
                    
                    if access_token:
                        print(f"Garmin Browser Auth: Successfully received access token", file=sys.stderr)
                        
                        # Save tokens to file
                        token_file = os.path.join(token_dir, f"{username}_tokens.json")
                        try:
                            print(f"Garmin Browser Auth: Saving tokens to {token_file}", file=sys.stderr)
                            with open(token_file, 'w') as f:
                                json.dump({
                                    "access_token": access_token,
                                    "refresh_token": refresh_token,
                                    "timestamp": time.time(),
                                    "user_agent": user_agent,
                                    "auth_method": "oauth_token"
                                }, f)
                            print(f"Garmin Browser Auth: Tokens saved successfully", file=sys.stderr)
                        except Exception as save_error:
                            print(f"Garmin Browser Auth: Warning - Could not save tokens: {str(save_error)}", file=sys.stderr)
                        
                        # Try to verify by getting user profile
                        try:
                            verify_headers = {
                                'Authorization': f'Bearer {access_token}',
                                'User-Agent': user_agent,
                                'Accept': 'application/json'
                            }
                            
                            verify_url = f"{BASE_URL}/userprofile-service/userprofile/personal-information"
                            verify_response = session.get(verify_url, headers=verify_headers, timeout=30)
                            
                            print(f"Garmin Browser Auth: Profile verification status: {verify_response.status_code}", file=sys.stderr)
                            
                            if verify_response.status_code == 200:
                                print(f"Garmin Browser Auth: Successfully verified user profile", file=sys.stderr)
                                
                                # Save cookies also, just in case
                                cookie_file = os.path.join(token_dir, f"{username}_cookies.json")
                                try:
                                    print(f"Garmin Browser Auth: Saving cookies to {cookie_file}", file=sys.stderr)
                                    cookie_dict = {cookie.name: cookie.value for cookie in session.cookies}
                                    with open(cookie_file, 'w') as f:
                                        json.dump({
                                            "cookies": cookie_dict,
                                            "timestamp": time.time(),
                                            "user_agent": user_agent,
                                            "auth_method": "oauth_token"
                                        }, f)
                                    print(f"Garmin Browser Auth: Cookies saved successfully", file=sys.stderr)
                                except Exception as save_error:
                                    print(f"Garmin Browser Auth: Warning - Could not save cookies: {str(save_error)}", file=sys.stderr)
                                
                                print(json.dumps({
                                    "status": "success", 
                                    "message": "Authentication successful using OAuth tokens",
                                }))
                                sys.exit(0)
                        except Exception as verify_error:
                            print(f"Garmin Browser Auth: Error verifying with token: {str(verify_error)}", file=sys.stderr)
                            # Still report success if we got the token
                            print(json.dumps({
                                "status": "success",
                                "message": "Authentication successful with token, but verification failed"
                            }))
                            sys.exit(0)
                except Exception as token_parse_error:
                    print(f"Garmin Browser Auth: Error parsing token response: {str(token_parse_error)}", file=sys.stderr)
            
            print(f"Garmin Browser Auth: Token API authentication failed", file=sys.stderr)
                
        except Exception as token_error:
            print(f"Garmin Browser Auth: Error with token authentication: {str(token_error)}", file=sys.stderr)
        
        # Step 3: Attempt basic auth through API as last resort
        try:
            print(f"Garmin Browser Auth: Attempting basic authentication through API", file=sys.stderr)
            
            basic_auth_url = f"{BASE_URL}/auth/signin/basic"
            
            basic_auth_headers = {
                'User-Agent': user_agent,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://sso.garmin.com',
                'Referer': 'https://sso.garmin.com/',
                'X-Requested-With': 'XMLHttpRequest'
            }
            
            basic_auth_data = {
                "username": username,
                "password": password
            }
            
            basic_auth_response = session.post(
                basic_auth_url, 
                headers=basic_auth_headers,
                json=basic_auth_data,
                timeout=30
            )
            
            print(f"Garmin Browser Auth: Basic auth API response status: {basic_auth_response.status_code}", file=sys.stderr)
            
            if basic_auth_response.status_code == 200 or basic_auth_response.status_code == 204:
                print(f"Garmin Browser Auth: Basic auth successful!", file=sys.stderr)
                
                # Save cookies to file
                cookie_file = os.path.join(token_dir, f"{username}_cookies.json")
                try:
                    print(f"Garmin Browser Auth: Saving cookies to {cookie_file}", file=sys.stderr)
                    cookie_dict = {cookie.name: cookie.value for cookie in session.cookies}
                    with open(cookie_file, 'w') as f:
                        json.dump({
                            "cookies": cookie_dict,
                            "timestamp": time.time(),
                            "user_agent": user_agent,
                            "auth_method": "basic_auth"
                        }, f)
                    print(f"Garmin Browser Auth: Cookies saved successfully", file=sys.stderr)
                except Exception as save_error:
                    print(f"Garmin Browser Auth: Warning - Could not save cookies: {str(save_error)}", file=sys.stderr)
                
                print(json.dumps({
                    "status": "success", 
                    "message": "Authentication successful using basic auth",
                }))
                sys.exit(0)
            
            print(f"Garmin Browser Auth: Basic auth failed", file=sys.stderr)
            
        except Exception as basic_auth_error:
            print(f"Garmin Browser Auth: Error with basic auth: {str(basic_auth_error)}", file=sys.stderr)
        
        # If we reached here, all authentication methods failed
        print(f"Garmin Browser Auth: All authentication methods failed", file=sys.stderr)
        print(json.dumps({
            "status": "error",
            "message": "All authentication methods failed, please try again later",
            "error_type": "auth_failure"
        }))
        sys.exit(1)
        
    except Exception as e:
        print(f"Garmin Browser Auth: Unexpected error: {str(e)}", file=sys.stderr)
        print(f"Garmin Browser Auth: Traceback: {traceback.format_exc()}", file=sys.stderr)
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(f"Garmin Browser Auth: Incorrect number of arguments", file=sys.stderr)
        print(json.dumps({"status": "error", "message": "Usage: python garmin_browser_auth.py <username> <password> <token_dir>"}))
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    token_dir = sys.argv[3]
    authenticate(username, password, token_dir) 