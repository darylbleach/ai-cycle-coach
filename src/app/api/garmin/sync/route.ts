import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const prisma = new PrismaClient();

// Convert exec to Promise-based
const execAsync = promisify(exec);

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic';

// This should be a secret key used by the cron job
const CRON_API_KEY = process.env.CRON_API_KEY || 'your-secure-cron-api-key';

// Function to get sample data for development
function getSampleData() {
  const today = new Date().toISOString().split('T')[0];
  return {
    status: "success",
    data: {
      date: today,
      hasData: true,
      validMetricsCount: 6,
      sleep: {
        sleepSeconds: 25200, // 7 hours
        sleepScore: 63
      },
      bodyBattery: 85,
      avgStress: 42,
      restingHeartRate: 58,
      hrv: {
        weeklyAvg: 45
      },
      trainingReadiness: 78
    }
  };
}

export async function POST(req: Request) {
  try {
    console.log('Garmin Sync: Starting sync process');
    
    // Check if this is a cron job request
    const isCronRequest = req.headers.get('X-Cron-API-Key') === CRON_API_KEY;
    let userId: string | undefined;
    let workoutsAdjusted = 0; // Initialize the variable at the top level
    
    // Handle authentication - either via session or cron job headers
    if (isCronRequest) {
      console.log('Garmin Sync: Request is from cron job');
      userId = req.headers.get('X-User-ID') || undefined;

      if (!userId) {
        console.error('Garmin Sync: Cron job request missing X-User-ID header');
        return NextResponse.json(
          { message: 'Missing X-User-ID header for cron job request' },
          { status: 400 }
        );
      }
      
      console.log(`Garmin Sync: Cron job requesting sync for user ${userId}`);
    } else {
      // Normal user session auth
      const session = await getServerSession(authOptions);

      if (!session) {
        console.error('Garmin Sync: No session found');
        return NextResponse.json(
          { message: 'Unauthorized - No session found' },
          { status: 401 }
        );
      }

      if (!session.user?.id) {
        console.error('Garmin Sync: Session does not contain user ID');
        console.log('Garmin Sync: Session data:', {
          hasUser: !!session.user,
          sessionKeys: Object.keys(session),
          userKeys: session.user ? Object.keys(session.user) : []
        });
        return NextResponse.json(
          { message: 'Unauthorized - No user ID in session' },
          { status: 401 }
        );
      }
      
      userId = session.user.id;
      console.log(`Garmin Sync: User authenticated with ID ${userId}`);
    }

    // Get requested date from request body, if provided
    let requestedDate: string | null = null;
    try {
      const body = await req.json();
      requestedDate = body?.date || null;
      console.log('Garmin Sync: Received request body:', body);
      console.log('Garmin Sync: Received request with date:', requestedDate);
    } catch (error) {
      console.log('Garmin Sync: No request body provided');
    }

    // Find the user's Garmin account
    console.log(`Garmin Sync: Looking for Garmin account for user ${userId}`);
    const garminAccount = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: 'garmin',
      },
    });

    if (!garminAccount) {
      console.error('Garmin Sync: No connected Garmin account found');
      return NextResponse.json(
        { message: 'No connected Garmin account found' },
        { status: 400 }
      );
    }

    console.log(`Garmin Sync: Found Garmin account: ${garminAccount.providerAccountId}`);

    // Check if we should use sample data for development
    const useSampleData = process.env.USE_SAMPLE_DATA === 'true';
    if (useSampleData) {
      console.log('Garmin Sync: Using sample data for development');
      const sampleData = getSampleData();
      
      // Store the sample data in the database for a more realistic test
      await storeHealthMetricsInDatabase(userId, sampleData.data);
      
      return NextResponse.json({
        message: 'Using sample data for development',
        date: sampleData.data.date,
        hasActualData: true,
        validMetricsCount: sampleData.data.validMetricsCount,
        workoutsAdjusted: 0
      });
    }

    // Call the direct Garmin sync python script
    try {
      console.log(`Garmin Sync: Calling direct sync script for ${garminAccount.providerAccountId}`);
      
      // Make sure the token directory exists
      const tokenDir = process.env.GARMIN_TOKEN_DIR || './garmin-tokens';
      await fs.mkdir(tokenDir, { recursive: true });
      
      // Retrieve the password from the request if provided
      let password = null;
      let requestData;
      try {
        // Use the already parsed body if available
        requestData = requestedDate ? { date: requestedDate } : {};
        
        // Try to add password from the session cache
        try {
          const sessionDir = `${tokenDir}/sessions`;
          await fs.mkdir(sessionDir, { recursive: true });
          const sessionFile = `${sessionDir}/${userId}.json`;
          
          try {
            const sessionData = await fs.readFile(sessionFile, 'utf8');
            const session = JSON.parse(sessionData);
            if (session?.password) {
              console.log('Garmin Sync: Using password from session cache');
              password = session.password;
            }
          } catch (e) {
            // No session file or invalid JSON, just continue without password
            console.log('Garmin Sync: No session password found');
          }
        } catch (e) {
          console.error(`Garmin Sync: Error reading session: ${e}`);
        }
      } catch (e) {
        console.error(`Garmin Sync: Error processing request data: ${e}`);
      }
      
      // Call the sync script with or without password
      const passwordParam = password ? `"${password}"` : '';
      // Use environment variable for Python path, or fallback to current directory
      const pythonPath = process.env.PYTHON_PATH || `${process.cwd()}/garmin-env/bin/python`;
      const syncCommand = `${pythonPath} scripts/garmin_direct_sync.py "${garminAccount.providerAccountId}" ${requestedDate ? `"${requestedDate}"` : ''} ${passwordParam}`;
      console.log(`Garmin Sync: Executing command: ${syncCommand.replace(passwordParam, password ? '"********"' : '')}`);
      
      const { stdout, stderr } = await execAsync(syncCommand);
      
      if (stderr) {
        console.error(`Garmin Sync: Script stderr: ${stderr}`);
      }
      
      let result: any;
      try {
        result = JSON.parse(stdout);
      } catch (e) {
        console.error(`Garmin Sync: Error parsing script output: ${e}`);
        console.error(`Garmin Sync: Raw output: ${stdout}`);
        return NextResponse.json(
          { message: 'Error parsing data from Garmin Connect script' },
          { status: 500 }
        );
      }
      
      console.log(`Garmin Sync: Script result status: ${result.status}`);
      
      if (result.status !== 'success') {
        console.error(`Garmin Sync: Script error: ${result.message}`);
        
        // Check if token expired, in which case we need to re-authenticate
        if (result.code === 'EXPIRED_SESSION' || result.code === 'AUTH_FAILED' || result.error_type === 'session_expired' || result.error_type === 'auth_error') {
          return NextResponse.json(
            { 
              message: result.message || 'Your Garmin session has expired. Please reconnect your Garmin account.',
              error_type: 'session_expired'
            },
            { status: 401 }
          );
        }
        
        return NextResponse.json(
          { message: result.message },
          { status: 400 }
        );
      }

      // Process the health data
      const healthData = result.data;
      console.log('Garmin Sync: Retrieved health data:', healthData);

      // Check if the data has valid metrics
      const hasActualData = healthData.hasData && healthData.validMetricsCount > 0;
      const validMetricsCount = healthData.validMetricsCount || 0;
      
      if (!hasActualData) {
        console.log('Garmin Sync: Warning - No valid health metrics found');
        return NextResponse.json(
          { 
            message: 'No valid health data found in Garmin Connect',
            requestedDate,
            date: healthData.date
          },
          { status: 404 }
        );
      } else {
        console.log(`Garmin Sync: Successfully retrieved real data from Garmin: ${validMetricsCount} valid metrics`);
      }

      // Store health metrics in database
      await storeHealthMetricsInDatabase(userId, healthData);

      // Handle workout adjustment if training readiness is available
      if (healthData.trainingReadiness) {
        console.log(`Garmin Sync: Training readiness score available (${healthData.trainingReadiness}), adjusting workouts`);
        try {
          workoutsAdjusted = await handleWorkoutAdjustment(userId, healthData.date, healthData.trainingReadiness);
        } catch (error) {
          console.error('Garmin Sync: Error adjusting workouts:', error);
        }
      } else {
        console.log('Garmin Sync: No training readiness score available, skipping workout adjustment');
      }

      return NextResponse.json({
        message: 'Data synced successfully',
        date: healthData.date,
        hasActualData,
        validMetricsCount,
        workoutsAdjusted
      });
    } catch (error) {
      console.error('Garmin Sync: Error executing Python script:', error);
      return NextResponse.json(
        { message: 'Failed to sync data from Garmin Connect: ' + (error as Error).message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Garmin Sync: Uncaught error:', error);
    return NextResponse.json(
      { message: 'Failed to sync data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to store health metrics in the database
async function storeHealthMetricsInDatabase(userId: string, healthData: any) {
  const syncDate = healthData.date;
  const formattedDate = new Date(syncDate);
  console.log(`Garmin Sync: Storing health data for date ${formattedDate} (${syncDate})`);

  // Gather user health data from the Garmin API response
  const metricData = {
    sleepHours: healthData.sleep?.sleepSeconds ? healthData.sleep.sleepSeconds / 3600 : null,
    sleepScore: healthData.sleep?.sleepScore || null,
    trainingReadiness: healthData.trainingReadiness || null,
    bodyBattery: healthData.bodyBattery || null,
    hrv: healthData.hrv?.weeklyAvg || null,
    avgStressLevel: healthData.avgStress || null,
    restingHeartRate: healthData.restingHeartRate || null,
    vo2max: null, // Always null as we're not displaying VO2max anymore
    syncedAt: new Date(),
  };

  // Debug log to help diagnose data discrepancies
  console.log(`Garmin Sync: Raw data received from Garmin for ${syncDate}:`, {
    sleep: healthData.sleep,
    bodyBattery: healthData.bodyBattery,
    avgStress: healthData.avgStress,
    restingHeartRate: healthData.restingHeartRate,
    hrv: healthData.hrv,
    trainingReadiness: healthData.trainingReadiness
  });
  
  console.log(`Garmin Sync: Processed data to be stored:`, metricData);
  
  // First check for any existing data for this date
  const existingMetric = await prisma.healthMetric.findUnique({
    where: {
      userId_date: {
        userId: userId,
        date: formattedDate,
      },
    },
  });
  
  if (existingMetric) {
    console.log('Garmin Sync: Found existing data for this date, will overwrite with real data');
    await prisma.healthMetric.delete({
      where: {
        userId_date: {
          userId: userId,
          date: formattedDate,
        },
      },
    });
  }
  
  // Store health data in database
  await prisma.healthMetric.upsert({
    where: {
      userId_date: {
        userId: userId,
        date: formattedDate,
      },
    },
    update: { ...metricData },
    create: {
      userId: userId,
      date: formattedDate,
      ...metricData
    },
  });

  // Verify the data was stored by retrieving it
  const storedMetric = await prisma.healthMetric.findUnique({
    where: {
      userId_date: {
        userId: userId,
        date: formattedDate,
      },
    },
  });

  console.log('Garmin Sync: Retrieved stored health data:', storedMetric);
  console.log('Garmin Sync: Health data stored successfully');
  
  return storedMetric;
}

// This function adjusts today's workout based on training readiness score
const handleWorkoutAdjustment = async (userId: string, date: string, trainingReadiness: number) => {
  console.log(`Workout Adjustment: Starting for user ${userId} on ${date}, training readiness: ${trainingReadiness}`);
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // If the date isn't today, don't adjust workouts
  if (date !== today) {
    console.log(`Workout Adjustment: Date ${date} is not today (${today}), skipping adjustment`);
    return 0;
  }
  
  // Get the user's training plans 
  const plans = await prisma.trainingPlan.findMany({
    where: {
      userId,
      isActive: true
    },
    include: {
      workouts: {
        where: {
          date: new Date(date)
        }
      }
    }
  });

  if (!plans.length) {
    console.log('Workout Adjustment: No active training plans found');
    return 0;
  }

  console.log(`Workout Adjustment: Found ${plans.length} active training plan(s)`);
  
  let workoutsAdjusted = 0;
  
  // For each plan, find today's workout and adjust it if needed
  for (const plan of plans) {
    const todaysWorkouts = plan.workouts;
    
    if (!todaysWorkouts.length) {
      console.log(`Workout Adjustment: No workouts scheduled for today in plan ${plan.id}`);
      continue;
    }
    
    for (const workout of todaysWorkouts) {
      // Clone the segments
      let segments = JSON.parse(JSON.stringify(workout.segments));
      let originalIntensity = 0;
      let adjustedIntensity = 0;
      let wasAdjusted = false;
      
      // Calculate adjustment factor based on training readiness
      // 80-100: No adjustment (1.0x)
      // 60-79: Small reduction (0.9x)
      // 40-59: Medium reduction (0.8x)
      // 0-39: Large reduction (0.7x)
      let adjustmentFactor = 1.0;
      
      if (trainingReadiness >= 80) {
        adjustmentFactor = 1.0;
      } else if (trainingReadiness >= 60) {
        adjustmentFactor = 0.9;
      } else if (trainingReadiness >= 40) {
        adjustmentFactor = 0.8;
      } else {
        adjustmentFactor = 0.7;
      }
      
      // Only adjust if we're reducing intensity
      if (adjustmentFactor < 1.0) {
        // Adjust each segment
        segments = segments.map((segment: any) => {
          // Skip warm up, cool down, or recovery segments
          if (segment.type.toLowerCase().includes('warm') || 
              segment.type.toLowerCase().includes('cool') ||
              segment.type.toLowerCase().includes('recovery')) {
            return segment;
          }
          
          originalIntensity = segment.intensity;
          // Round to nearest 5% to keep clean numbers
          adjustedIntensity = Math.round((segment.intensity * adjustmentFactor) / 5) * 5;
          
          // Don't adjust if the change would be less than 5%
          if (originalIntensity - adjustedIntensity < 5) {
            return segment;
          }
          
          // Update the segment
          wasAdjusted = true;
          return {
            ...segment,
            intensity: adjustedIntensity,
            description: segment.description + ` (adjusted from ${originalIntensity}%)`
          };
        });
        
        if (wasAdjusted) {
          // Update the workout
          console.log(`Workout Adjustment: Adjusting workout ${workout.id} based on training readiness ${trainingReadiness}`);
          await prisma.workout.update({
            where: { id: workout.id },
            data: { 
              segments,
              name: workout.name + ' (Adjusted)',
              description: workout.description + `\n\nThis workout was automatically adjusted based on your training readiness score of ${trainingReadiness}/100.`
            }
          });
          workoutsAdjusted++;
        } else {
          console.log(`Workout Adjustment: No adjustments needed for workout ${workout.id}`);
        }
      } else {
        console.log(`Workout Adjustment: Training readiness ${trainingReadiness} is high, no adjustment needed`);
      }
    }
  }
  
  console.log(`Workout Adjustment: Completed, adjusted ${workoutsAdjusted} workouts`);
  return workoutsAdjusted;
}; 