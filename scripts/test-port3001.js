// This script tests the daily-sync endpoint with environment detection
import fetch from 'node-fetch';

async function testSync() {
  try {
    const CRON_API_KEY = process.env.CRON_API_KEY || 'your-secure-api-key';
    
    // Determine base URL based on environment
    // 1. Use BASE_URL env var if defined
    // 2. Use VERCEL_URL if defined (add https://)
    // 3. Default to localhost:3001 for development
    const baseUrl = process.env.BASE_URL 
      ? process.env.BASE_URL 
      : process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3001';
    
    console.log(`Testing daily sync on ${baseUrl}...`);
    
    // Call the daily-sync endpoint with the correct header
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
    } else {
      console.error(`Failed to trigger sync. Status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error:', errorText);
    }
  } catch (error) {
    console.error('Error testing sync:', error);
  }
}

testSync(); 