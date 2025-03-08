import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { format, subDays } from 'date-fns';

// Force reload of the route
const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Use environment variable for Python path or fallback
const PYTHON_PATH = process.env.PYTHON_PATH || path.join(process.cwd(), 'garmin-env/bin/python');

// Get API keys from environment
const CRON_API_KEY = process.env.CRON_API_KEY || 'default_cron_api_key_for_dev';
// Optional key for workout adjustments
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'your_internal_api_key_for_workout_adjustment';

// Maximum number of retry attempts for each user (8 retries = 4 hours total)
const MAX_RETRY_ATTEMPTS = 8;

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic';

/**
 * Daily Sync Cron Job
 * 
 * This route is designed to be called by a cron job that runs at 7am daily.
 * It performs the following actions:
 * 1. Syncs Garmin data for all users with connected Garmin accounts
 * 2. Adjusts today's workouts based on each user's recovery metrics
 * 3. If real data is not available, will retry every 30 minutes
 */
export async function GET(req: Request) {
  try {
    // Check if this is a retry request
    const url = new URL(req.url);
    const isRetry = url.searchParams.has('retry');
    const retryCount = parseInt(url.searchParams.get('retryCount') || '0');
    const retryUserIds = url.searchParams.get('retryUserIds')?.split(',') || [];
    
    if (isRetry) {
      console.log(`Daily Sync: Retry attempt ${retryCount} for users: ${retryUserIds.join(', ')}`);
    } else {
      console.log('Daily Sync: Starting cron job for daily Garmin data sync at 7am');
    }
    
    // Check for API key in authorization header
    const apiKey = req.headers.get('X-Cron-API-Key');
    if (apiKey !== CRON_API_KEY) {
      console.error('Daily Sync: Unauthorized access attempt with incorrect API key');
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get today's date for syncing current data
    const today = new Date();
    const syncDate = today.toISOString().split('T')[0];
    console.log(`Daily Sync: Syncing data for today's date ${syncDate}`);
    
    // Get users to process - either from retry params or all Garmin accounts
    let accountsToProcess = [];
    
    if (isRetry && retryUserIds.length > 0) {
      // For retry, get only the specific users that need a retry
      const accounts = await prisma.account.findMany({
        where: {
          provider: 'garmin',
          userId: {
            in: retryUserIds
          }
        },
        select: {
          providerAccountId: true,
          userId: true,
        }
      });
      accountsToProcess = accounts;
    } else {
      // Get all users with connected Garmin accounts
      const allAccounts = await prisma.account.findMany({
        where: {
          provider: 'garmin',
        },
        select: {
          providerAccountId: true,
          userId: true,
        }
      });
      accountsToProcess = allAccounts;
    }
    
    console.log(`Daily Sync: Found ${accountsToProcess.length} Garmin accounts to sync`);
    
    // Track results for each user
    const results = {
      total: accountsToProcess.length,
      succeeded: 0,
      failed: 0,
      needsRetry: 0,
      workoutsAdjusted: 0,
      usersToRetry: [] as string[],
      errors: [] as Array<{ userId: string; error: string }>
    };
    
    // Get the base URL for API requests
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    // Sync data for each user
    for (const account of accountsToProcess) {
      try {
        console.log(`Daily Sync: Processing user ${account.userId} with Garmin account ${account.providerAccountId}`);
        
        // Instead of directly calling the Python script, call the Garmin sync API endpoint
        // This uses the same method as the manual sync button
        try {
          console.log(`Daily Sync: Calling Garmin sync API for user ${account.userId}`);
          
          // Create a server-side fetch request to the Garmin sync API
          const syncResponse = await fetch(`${baseUrl}/api/garmin/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // This is a special header to authorize this request as if it were from the user
              'X-Cron-API-Key': CRON_API_KEY,
              'X-User-ID': account.userId  // Add user ID for server-side auth
            },
            body: JSON.stringify({
              date: syncDate,
              userId: account.userId  // Include the user ID in the body as well
            })
          });
          
          if (!syncResponse.ok) {
            const errorText = await syncResponse.text();
            throw new Error(`Sync API returned error: ${syncResponse.status} - ${errorText}`);
          }
          
          const syncResult = await syncResponse.json();
          console.log(`Daily Sync: Garmin sync API response for user ${account.userId}:`, syncResult);
          
          // Check if we have real data
          const hasRealData = syncResult.hasActualData === true && 
                              syncResult.validMetricsCount > 0;
          
          if (!hasRealData) {
            console.log(`Daily Sync: No real health data retrieved for user ${account.userId}, marking for retry`);
            results.needsRetry++;
            results.usersToRetry.push(account.userId);
            continue;
          }
          
          console.log(`Daily Sync: Successfully retrieved and stored real data for user ${account.userId}`);
          results.succeeded++;
          
          // If we have a valid training readiness score, adjust today's workouts
          if (syncResult.data.trainingReadiness) {
            console.log(`Daily Sync: Adjusting workouts for user ${account.userId} based on training readiness score: ${syncResult.data.trainingReadiness}`);
            
            // Call the workout adjustment API
            try {
              const adjustmentResponse = await fetch(`${baseUrl}/api/training/adjust-workouts`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': CRON_API_KEY
                },
                body: JSON.stringify({
                  userId: account.userId,
                  date: syncDate
                })
              });
              
              if (adjustmentResponse.ok) {
                const adjustmentResult = await adjustmentResponse.json();
                console.log(`Daily Sync: Successfully adjusted ${adjustmentResult.adjustedCount} workouts for user ${account.userId}`);
                results.workoutsAdjusted += adjustmentResult.adjustedCount;
              } else {
                const errorText = await adjustmentResponse.text();
                console.error(`Daily Sync: Failed to adjust workouts for user ${account.userId}:`, errorText);
              }
            } catch (error) {
              console.error(`Daily Sync: Error adjusting workouts for user ${account.userId}:`, error);
            }
          } else {
            console.log(`Daily Sync: No training readiness score available for user ${account.userId}, skipping workout adjustment`);
          }
        } catch (error) {
          console.error(`Daily Sync: Error calling Garmin sync API for user ${account.userId}:`, error);
          results.failed++;
          results.errors.push({ 
            userId: account.userId, 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } catch (error) {
        console.error(`Daily Sync: Error processing user ${account.userId}:`, error);
        results.failed++;
        results.errors.push({ 
          userId: account.userId, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    console.log(`Daily Sync: Completed with ${results.succeeded} successes, ${results.failed} failures, and ${results.needsRetry} users needing retry. Adjusted ${results.workoutsAdjusted} workouts.`);
    
    // Schedule retry if needed
    if (results.usersToRetry.length > 0 && (retryCount < MAX_RETRY_ATTEMPTS)) {
      // Schedule a retry in 30 minutes for users without real data
      const nextRetryCount = retryCount + 1;
      const retryUserIdsParam = results.usersToRetry.join(',');
      
      console.log(`Daily Sync: Scheduling retry #${nextRetryCount} in 30 minutes for ${results.usersToRetry.length} users`);
      
      // Create a fetch request that will execute after 30 minutes
      setTimeout(async () => {
        try {
          // Create retry URL with params
          const retryUrl = new URL(`${baseUrl}/api/cron/daily-sync`);
          retryUrl.searchParams.set('retry', 'true');
          retryUrl.searchParams.set('retryCount', nextRetryCount.toString());
          retryUrl.searchParams.set('retryUserIds', retryUserIdsParam);
          
          const retryResponse = await fetch(retryUrl.toString(), {
            method: 'GET',
            headers: {
              'X-Cron-API-Key': CRON_API_KEY
            }
          });
          
          console.log(`Daily Sync: Scheduled retry #${nextRetryCount} initiated with status: ${retryResponse.status}`);
        } catch (error) {
          console.error(`Daily Sync: Failed to execute scheduled retry:`, error);
        }
      }, 30 * 60 * 1000); // 30 minutes in milliseconds
    }
    
    return NextResponse.json({
      message: 'Daily sync completed',
      results,
      isRetry,
      retryCount,
      retryScheduled: results.usersToRetry.length > 0 && (retryCount < MAX_RETRY_ATTEMPTS)
    }, { status: 200 });
  } catch (error) {
    console.error('Daily Sync: Error in cron job:', error);
    return NextResponse.json(
      { message: 'Failed to execute daily sync: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 