/**
 * Test Daily Sync and Workout Adjustment
 * 
 * This script simulates a call to the daily sync cron job
 * for testing workout adjustments based on Garmin data.
 * 
 * Usage: node scripts/test-daily-sync.js
 */

const apiKey = process.env.CRON_API_KEY || 'your-secure-api-key';
const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

console.log('Testing Daily Sync and Workout Adjustment Process...');

async function testDailySync() {
  try {
    console.log(`Making request to ${baseUrl}/api/cron/daily-sync`);
    
    const response = await fetch(`${baseUrl}/api/cron/daily-sync`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey
      }
    });
    
    const result = await response.json();
    
    console.log('Response:', {
      status: response.status,
      statusText: response.statusText,
      result
    });
    
    if (response.ok) {
      console.log('✅ Success! Daily sync completed.');
      console.log(`Processed ${result.results.total} users: ${result.results.succeeded} succeeded, ${result.results.failed} failed`);
      console.log(`Adjusted ${result.results.workoutsAdjusted} workouts based on training readiness scores`);
      
      if (result.results.errors.length > 0) {
        console.log('Errors:', result.results.errors);
      }
    } else {
      console.error('❌ Failed to run daily sync process');
    }
  } catch (error) {
    console.error('Error testing daily sync:', error);
  }
}

testDailySync(); 