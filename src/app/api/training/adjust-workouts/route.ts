import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { format, parseISO } from 'date-fns';

const prisma = new PrismaClient();

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic';

// This route adjusts today's workout intensity based on the user's training readiness
export async function POST(req: Request) {
  try {
    console.log('Workout Adjustment: Starting workout adjustment process');
    
    // Check for API key in authorization header (same as used by cron job)
    const apiKey = req.headers.get('X-API-Key');
    const CRON_API_KEY = process.env.CRON_API_KEY || 'your-secure-api-key';
    
    if (apiKey !== CRON_API_KEY) {
      console.error('Workout Adjustment: Unauthorized access attempt with incorrect API key');
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await req.json();
    const { userId, date } = body;
    
    if (!userId || !date) {
      console.error('Workout Adjustment: Missing required parameters', { userId, date });
      return NextResponse.json(
        { message: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    console.log(`Workout Adjustment: Processing adjustments for user ${userId} on date ${date}`);
    
    // Get today's training readiness score
    const today = date ? new Date(date) : new Date();
    const formattedDate = format(today, 'yyyy-MM-dd');
    
    const healthMetrics = await prisma.healthMetric.findUnique({
      where: {
        userId_date: {
          userId,
          date: parseISO(formattedDate),
        },
      },
    });
    
    if (!healthMetrics || healthMetrics.trainingReadiness === null) {
      console.log(`Workout Adjustment: No training readiness data found for ${formattedDate}`);
      return NextResponse.json(
        { message: 'No training readiness data found for today' },
        { status: 404 }
      );
    }
    
    const trainingReadiness = healthMetrics.trainingReadiness;
    console.log(`Workout Adjustment: Found training readiness score: ${trainingReadiness}`);
    
    // Find active training plans for this user
    const activePlans = await prisma.trainingPlan.findMany({
      where: {
        userId,
        isActive: true,
      },
    });
    
    if (activePlans.length === 0) {
      console.log(`Workout Adjustment: No active training plans found for user ${userId}`);
      return NextResponse.json(
        { message: 'No active training plans found' },
        { status: 404 }
      );
    }
    
    // Find today's workouts across all active plans
    const todaysWorkouts = await prisma.workout.findMany({
      where: {
        trainingPlanId: {
          in: activePlans.map(plan => plan.id),
        },
        date: {
          gte: new Date(formattedDate + 'T00:00:00.000Z'),
          lt: new Date(formattedDate + 'T23:59:59.999Z'),
        },
      },
    });
    
    if (todaysWorkouts.length === 0) {
      console.log(`Workout Adjustment: No workouts scheduled for ${formattedDate}`);
      return NextResponse.json(
        { message: 'No workouts scheduled for today' },
        { status: 200 }
      );
    }
    
    console.log(`Workout Adjustment: Found ${todaysWorkouts.length} workouts for ${formattedDate}`);
    
    // Adjustment logic based on training readiness
    // This will scale workout intensity up or down based on readiness
    const adjustedWorkouts = [];
    
    for (const workout of todaysWorkouts) {
      const segments = workout.segments as any[];
      
      // Adjust intensity based on training readiness
      // readiness 80-100: increase intensity by 5-10%
      // readiness 60-79: maintain original intensity
      // readiness 40-59: decrease intensity by 10-20%
      // readiness below 40: decrease intensity by 25-40% or suggest rest day
      
      let intensityMultiplier = 1.0; // Default: no change
      let adjustmentMessage = '';
      
      if (trainingReadiness >= 80) {
        // User is very well recovered - can handle slightly higher intensity
        intensityMultiplier = 1.05;
        adjustmentMessage = 'Excellent recovery detected! Workout intensity slightly increased.';
      } else if (trainingReadiness >= 60) {
        // User is well recovered - maintain planned intensity
        intensityMultiplier = 1.0;
        adjustmentMessage = 'Good recovery detected. Workout maintained at planned intensity.';
      } else if (trainingReadiness >= 40) {
        // User is moderately recovered - decrease intensity
        intensityMultiplier = 0.85;
        adjustmentMessage = 'Moderate recovery detected. Workout intensity reduced to aid recovery.';
      } else {
        // User is poorly recovered - significantly decrease intensity or suggest rest
        intensityMultiplier = 0.65;
        adjustmentMessage = 'Poor recovery detected. Workout intensity significantly reduced. Consider rest if feeling fatigued.';
      }
      
      // Apply adjustment to segments
      const adjustedSegments = segments.map(segment => {
        // Only adjust intensity for non-rest segments
        if (segment.type !== 'rest') {
          return {
            ...segment,
            intensity: Math.round(segment.intensity * intensityMultiplier),
            // Add a note about the adjustment
            description: segment.description + (
              segment.description.includes('Auto-adjusted') 
                ? '' 
                : ` (Auto-adjusted: ${Math.round((intensityMultiplier-1)*100)}% based on recovery)`
            )
          };
        }
        return segment;
      });
      
      // Update the workout with adjusted segments and add a note
      const updatedWorkout = await prisma.workout.update({
        where: {
          id: workout.id,
        },
        data: {
          segments: adjustedSegments as any,
          description: `${workout.description || ''}\n\n${adjustmentMessage} (Training Readiness: ${trainingReadiness}/100)`
        },
      });
      
      adjustedWorkouts.push(updatedWorkout);
    }
    
    // Create a notification for the user about the workout adjustments
    if (adjustedWorkouts.length > 0) {
      let notificationTitle = '';
      let notificationMessage = '';
      
      if (trainingReadiness >= 80) {
        notificationTitle = 'Workout Intensity Increased';
        notificationMessage = `Based on your excellent recovery (${trainingReadiness}/100), today's ${adjustedWorkouts.length > 1 ? 'workouts have' : 'workout has'} been slightly increased in intensity.`;
      } else if (trainingReadiness >= 60) {
        notificationTitle = 'Workout Maintained';
        notificationMessage = `Based on your good recovery (${trainingReadiness}/100), today's ${adjustedWorkouts.length > 1 ? 'workouts have' : 'workout has'} been maintained at the planned intensity.`;
      } else if (trainingReadiness >= 40) {
        notificationTitle = 'Workout Intensity Reduced';
        notificationMessage = `Based on your moderate recovery (${trainingReadiness}/100), today's ${adjustedWorkouts.length > 1 ? 'workouts have' : 'workout has'} been reduced in intensity to aid recovery.`;
      } else {
        notificationTitle = 'Workout Significantly Reduced';
        notificationMessage = `Based on your poor recovery (${trainingReadiness}/100), today's ${adjustedWorkouts.length > 1 ? 'workouts have' : 'workout has'} been significantly reduced in intensity. Consider rest if feeling fatigued.`;
      }
      
      await prisma.notification.create({
        data: {
          userId,
          type: 'workout_adjustment',
          title: notificationTitle,
          message: notificationMessage,
        }
      });
      
      console.log(`Workout Adjustment: Created notification for user ${userId} about workout adjustments`);
    }
    
    console.log(`Workout Adjustment: Successfully adjusted ${adjustedWorkouts.length} workouts based on training readiness score of ${trainingReadiness}`);
    
    return NextResponse.json({
      message: 'Workouts adjusted successfully',
      adjustedCount: adjustedWorkouts.length,
      trainingReadiness,
    }, { status: 200 });
  } catch (error) {
    console.error('Workout Adjustment: Error in adjustment process:', error);
    return NextResponse.json(
      { message: 'Failed to adjust workouts: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 