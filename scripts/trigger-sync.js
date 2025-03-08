// This script triggers an immediate sync by calling the daily-sync endpoint
// It's useful for testing or forcing a sync outside the scheduled cron job

import fetch from 'node-fetch';

// Function to try a specific port when in development mode
async function tryLocalPort(port) {
  try {
    const CRON_API_KEY = process.env.CRON_API_KEY || 'your-secure-api-key';
    
    const BASE_URL = `http://localhost:${port}`;
    console.log(`Trying to trigger daily sync on ${BASE_URL}...`);
    
    // Call the daily-sync endpoint
    const response = await fetch(`${BASE_URL}/api/cron/daily-sync`, {
      method: 'GET',
      headers: {
        'X-Cron-API-Key': CRON_API_KEY
      }
    });
    
    console.log(`Response status from port ${port}: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log(`Sync triggered successfully on port ${port}!`);
      console.log('Results:', JSON.stringify(result, null, 2));
      return true;
    } else {
      // If we get a 401 or other error, the endpoint exists but auth failed
      // This means we found the right port, even if auth failed
      if (response.status !== 404) {
        console.error(`Found endpoint on port ${port}, but sync failed. Status: ${response.status}`);
        const errorText = await response.text();
        console.error('Error:', errorText);
        return true; // We found the right port, even though auth failed
      }
      return false;
    }
  } catch (error) {
    console.error(`Error trying port ${port}:`, error.message);
    return false;
  }
}

// Function to trigger sync against a production URL
async function triggerProductionSync(baseUrl) {
  try {
    const CRON_API_KEY = process.env.CRON_API_KEY || 'your-secure-api-key';
    
    console.log(`Triggering daily sync on ${baseUrl}...`);
    
    // Call the daily-sync endpoint
    const response = await fetch(`${baseUrl}/api/cron/daily-sync`, {
      method: 'GET',
      headers: {
        'X-Cron-API-Key': CRON_API_KEY
      }
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Sync triggered successfully!');
      console.log('Results:', JSON.stringify(result, null, 2));
      return true;
    } else {
      console.error(`Failed to trigger sync. Status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error:', errorText);
      return false;
    }
  } catch (error) {
    console.error(`Error triggering sync on ${baseUrl}:`, error.message);
    return false;
  }
}

async function triggerSync() {
  try {
    // Check if we're in production mode with VERCEL_URL or BASE_URL env var
    const vercelUrl = process.env.VERCEL_URL;
    const baseUrl = process.env.BASE_URL;
    
    // If we have a production URL, use it
    if (vercelUrl) {
      return await triggerProductionSync(`https://${vercelUrl}`);
    } else if (baseUrl) {
      return await triggerProductionSync(baseUrl);
    }
    
    // Otherwise we're in local development mode, try several ports
    console.log('No production URL found. Trying local development ports...');
    const ports = [3001, 3000, 3002];
    let success = false;
    
    for (const port of ports) {
      success = await tryLocalPort(port);
      if (success) break;
    }
    
    if (!success) {
      console.error('Failed to trigger sync on any port. Is the server running?');
    }
  } catch (error) {
    console.error('Unexpected error triggering sync:', error);
  }
}

triggerSync(); 