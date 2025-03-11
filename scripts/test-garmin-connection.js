#!/usr/bin/env node
/**
 * Test Garmin Connection Script
 * -----------------------------
 * This script tests the connection to Garmin by checking the token status.
 * 
 * Usage: node test-garmin-connection.js <email>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get Garmin email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Please provide the Garmin email address');
  console.error('Usage: node test-garmin-connection.js <email>');
  process.exit(1);
}

// Get environment variables
const tokenDir = process.env.GARMIN_TOKEN_DIR || './garmin-tokens';
const pythonPath = process.env.PYTHON_PATH || './garmin-env/bin/python';

// Function to check if token exists and is valid
function checkToken() {
  console.log(`Checking token for ${email}...`);
  
  const tokenFile = path.join(tokenDir, `${email}.json`);
  
  if (!fs.existsSync(tokenFile)) {
    console.error(`Token file not found: ${tokenFile}`);
    return false;
  }
  
  try {
    const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    
    if (!tokenData.garth_token) {
      console.error('Invalid token format: missing garth_token');
      return false;
    }
    
    const { access_token, refresh_token, expires_at } = tokenData.garth_token;
    
    if (!access_token || access_token === 'placeholder_access_token') {
      console.error('Invalid access token (placeholder)');
      return false;
    }
    
    if (!refresh_token || refresh_token === 'placeholder_refresh_token') {
      console.error('Invalid refresh token (placeholder)');
      return false;
    }
    
    if (!expires_at || expires_at === 0) {
      console.error('Token is expired');
      return false;
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (expires_at < now) {
      console.error(`Token expired at ${new Date(expires_at * 1000).toISOString()}`);
      return false;
    }
    
    const expiresIn = Math.floor((expires_at - now) / 60);
    console.log(`Token is valid and expires in ${expiresIn} minutes`);
    return true;
  } catch (error) {
    console.error('Error reading token file:', error.message);
    return false;
  }
}

// Function to test Garmin sync
function testSync() {
  try {
    console.log('Testing Garmin sync functionality...');
    
    const command = `${pythonPath} scripts/garmin_direct_sync.py "${email}" "${tokenDir}"`;
    console.log(`Executing: ${command}`);
    
    const output = execSync(command, { encoding: 'utf8' });
    console.log('Sync test output:');
    console.log(output);
    
    try {
      const result = JSON.parse(output);
      if (result.status === 'success') {
        console.log('Sync test SUCCESSFUL!');
        return true;
      } else {
        console.error('Sync test FAILED:', result.error || 'Unknown error');
        return false;
      }
    } catch (parseError) {
      console.error('Error parsing sync test output:', parseError.message);
      return false;
    }
  } catch (error) {
    console.error('Error running sync test:', error.message);
    return false;
  }
}

// Run the token check
const tokenValid = checkToken();

if (!tokenValid) {
  console.log('\nToken is invalid or expired. You need to reconnect your Garmin account.');
  console.log('Please go to the website and reconnect your Garmin account.');
} else {
  console.log('\nToken looks valid. Testing sync functionality...');
  const syncWorking = testSync();
  
  if (syncWorking) {
    console.log('\nAll tests PASSED! Garmin connection is working correctly.');
  } else {
    console.log('\nSync test FAILED. Please check the logs for more details.');
    console.log('You may need to reconnect your Garmin account.');
  }
} 