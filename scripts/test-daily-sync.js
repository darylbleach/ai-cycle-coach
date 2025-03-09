#!/usr/bin/env node
/**
 * Test Script for Daily Garmin Sync
 * 
 * This script tests the daily Garmin sync functionality by directly calling the cron endpoint.
 * 
 * Usage:
 *   node scripts/test-daily-sync.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment variables from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log('No .env.local file found, using default environment variables');
  dotenv.config();
}

// Configuration
const CRON_API_KEY = process.env.CRON_API_KEY || 'secure_cron_api_key_for_daily_sync';
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Function to make HTTP request
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // Try to parse as JSON, fall back to raw data if it fails
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, headers: res.headers, data: jsonData });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, data, error: 'Not valid JSON' });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.end();
  });
}

async function testDailySync() {
  console.log('Testing daily Garmin sync...');
  console.log(`Using base URL: ${BASE_URL}`);
  console.log(`Using cron API key: ${CRON_API_KEY ? '********' : 'Not set'}`);
  
  if (!CRON_API_KEY) {
    console.error('Error: CRON_API_KEY is not set in the environment variables.');
    console.error('Please set it in your .env.local file before running this script.');
    process.exit(1);
  }
  
  try {
    const url = `${BASE_URL}/api/cron/daily-sync`;
    
    console.log(`Making request to: ${url}`);
    
    const result = await makeRequest(url, {
      method: 'GET',
      headers: {
        'X-Cron-API-Key': CRON_API_KEY
      }
    });
    
    console.log(`Response status code: ${result.statusCode}`);
    
    if (result.statusCode === 200) {
      console.log('Daily sync test was successful! Response:');
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.error(`Error: Received status code ${result.statusCode}`);
      console.error('Response data:');
      console.error(JSON.stringify(result.data, null, 2));
    }
  } catch (error) {
    console.error('Error making request:', error);
  }
}

// Run the test
testDailySync(); 