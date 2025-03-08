import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { OpenAI } from 'openai'
import { authOptions } from '@/lib/auth'

const prisma = new PrismaClient()
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Create a schema for validation
const planSchema = z.object({
  type: z.enum(['POWER', 'FITNESS']),
  daysPerWeek: z.number().min(3).max(7),
  restDays: z.array(z.number().min(0).max(6)),
  startDate: z.string().datetime(),
  duration: z.number().min(4).max(24).optional().default(4), // Add duration with default of 4 weeks
  intensity: z.enum(['EASY', 'MEDIUM', 'HARD']).optional().default('MEDIUM'), // Add intensity level
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
      console.log('Training Plan: No authenticated user session', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!session?.user?.id
      });
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log(`Training Plan: Creating plan for user ${session.user.id}`);
    
    const body = await req.json()
    
    // Validate the input
    const result = planSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { message: 'Invalid input', errors: result.error.flatten() },
        { status: 400 }
      )
    }

    const { type, daysPerWeek, restDays, startDate, intensity } = result.data
    const duration = result.data.duration || 4 // Default to 4 weeks if not provided

    // Get the user's FTP
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ftp: true },
    })

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Create the training plan
    const trainingPlan = await prisma.trainingPlan.create({
      data: {
        userId: session.user.id,
        name: `${type === 'POWER' ? 'Power' : 'Fitness'} Plan (${intensity.charAt(0) + intensity.slice(1).toLowerCase()})`,
        type,
        daysPerWeek,
        restDays,
        startDate: new Date(startDate),
        endDate: new Date(new Date(startDate).setDate(new Date(startDate).getDate() + (duration * 7))), // Calculate based on weeks
        intensity, // Store the intensity level
      },
    })

    // Generate workouts using AI
    await generateWorkouts(trainingPlan.id, type, daysPerWeek, restDays, new Date(startDate), user.ftp || 200, duration, intensity)

    return NextResponse.json(
      { trainingPlan },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create training plan error:', error)
    return NextResponse.json(
      { message: 'An error occurred while creating the training plan' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

async function generateWorkouts(
  trainingPlanId: string,
  planType: string,
  daysPerWeek: number,
  restDays: number[],
  startDate: Date,
  ftp: number,
  duration: number = 4, // Default to 4 weeks if not specified
  intensity: string = 'MEDIUM' // Default to MEDIUM intensity
) {
  try {
    console.log(`Starting workout generation for training plan ${trainingPlanId} with intensity ${intensity}`);
    // Generate workouts for the specified duration
    const workouts = []
    const currentDate = new Date(startDate)
    
    // Count how many workouts we need to generate
    let totalWorkoutsNeeded = 0;
    const tempDate = new Date(startDate);
    for (let week = 0; week < duration; week++) {
      for (let day = 0; day < 7; day++) {
        if (!restDays.includes(tempDate.getDay())) {
          totalWorkoutsNeeded++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
    }
    
    console.log(`Need to generate ${totalWorkoutsNeeded} workouts for ${duration} week plan`);
    let workoutsGenerated = 0;
    let workoutsInWeek = 0;
    let currentWeek = 0;

    for (let week = 0; week < duration; week++) {
      workoutsInWeek = 0;
      
      for (let day = 0; day < 7; day++) {
        // Skip rest days
        if (restDays.includes(currentDate.getDay())) {
          currentDate.setDate(currentDate.getDate() + 1)
          continue
        }

        workoutsInWeek++;
        
        try {
          // Check if this should be a base ride
          // Always make one ride per week a base ride (the first workout of the week)
          const isBaseRide = workoutsInWeek === 1;
          
          // Generate workout for this day
          console.log(`Generating workout ${workoutsGenerated + 1}/${totalWorkoutsNeeded} for ${currentDate.toDateString()} ${isBaseRide ? '(Base Ride)' : ''}`);
          
          const workout = isBaseRide 
            ? generateBaseRide(planType, ftp, intensity)
            : await generateWorkoutForDay(planType, week, day, ftp, duration, intensity);
          
          workouts.push({
            trainingPlanId,
            name: workout.name,
            description: workout.description,
            date: new Date(currentDate),
            duration: workout.duration,
            segments: workout.segments,
          })
          
          workoutsGenerated++;
          console.log(`Successfully generated workout ${workoutsGenerated}/${totalWorkoutsNeeded}`);
        } catch (workoutError) {
          console.error(`Failed to generate workout for day ${currentDate.toDateString()}:`, workoutError);
          // Still increment the date even if workout generation fails
        }

        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      currentWeek++;
    }

    if (workouts.length === 0) {
      console.error('No workouts were successfully generated');
      throw new Error('Failed to generate any workouts');
    }

    console.log(`Saving ${workouts.length} workouts to database`);
    // Save workouts to database
    await prisma.workout.createMany({
      data: workouts,
    })
    console.log('Successfully saved workouts to database');

    return workouts
  } catch (error) {
    console.error('Error in generateWorkouts function:', error)
    throw error
  }
}

// Function to generate a standard base ride
function generateBaseRide(
  planType: string,
  ftp: number,
  intensity: string = 'MEDIUM'
): {
  name: string
  description: string
  duration: number
  segments: any
} {
  // Adjust base ride duration based on intensity level
  let baseDuration = 60; // Default 60 minutes for MEDIUM
  
  if (intensity === 'EASY') {
    baseDuration = 45; // Shorter for EASY
  } else if (intensity === 'HARD') {
    baseDuration = 90; // Longer for HARD
  }
  
  return {
    name: `Base ${planType === 'POWER' ? 'Power' : 'Endurance'} Ride`,
    description: 'A steady state ride to build endurance and aerobic capacity.',
    duration: baseDuration,
    segments: [
      {
        type: 'warmup',
        duration: 10,
        intensity: 50,
        description: 'Gentle pedaling to warm up muscles and prepare for the workout.'
      },
      {
        type: 'interval',
        duration: baseDuration - 20, // Main segment
        intensity: 60,
        description: 'Steady endurance pace to build aerobic capacity.'
      },
      {
        type: 'cooldown',
        duration: 10,
        intensity: 45,
        description: 'Easy spinning to gradually reduce heart rate and recover.'
      }
    ],
  };
}


async function generateWorkoutForDay(
  planType: string,
  week: number,
  dayOfWeek: number,
  ftp: number,
  totalWeeks: number = 4, // Default to 4 weeks if not specified
  intensity: string = 'MEDIUM' // Default to MEDIUM intensity
): Promise<{
  name: string
  description: string
  duration: number
  segments: any
}> {
  try {
    // Adjust workout durations based on intensity level
    let durationModifier = 1.0; // Default multiplier for MEDIUM
    let intensityOffset = 0; // Default intensity offset
    
    if (intensity === 'EASY') {
      durationModifier = 0.8; // Shorter workouts for EASY
      intensityOffset = -10; // Lower intensity by 10%
    } else if (intensity === 'HARD') {
      durationModifier = 1.2; // Longer workouts for HARD
      intensityOffset = 5; // Higher intensity by 5%
    }
    
    // Use OpenAI to generate a workout
    const prompt = `
      Generate a cycling workout for a ${planType === 'POWER' ? 'power-focused' : 'fitness-focused'} training plan.
      This is for week ${week + 1} of a ${totalWeeks}-week plan, day ${dayOfWeek + 1} of the week.
      The athlete's FTP is ${ftp} watts.
      The intensity level selected is ${intensity.toLowerCase()}, so adjust the workout accordingly.
      
      Return the response as a JSON object with the following structure:
      {
        "name": "Workout name",
        "description": "Brief description of the workout and its benefits",
        "duration": total_duration_in_minutes,
        "segments": [
          {
            "type": "warmup|interval|recovery|cooldown|sprint",
            "duration": duration_in_minutes,
            "intensity": percentage_of_ftp,
            "description": "Description of this segment"
          }
        ]
      }
      
      Important notes:
      - Follow these guidelines for intensity and duration combinations:
        * 100-120% FTP: 5-20 minutes maximum
        * 120-150% FTP: 2-5 minutes maximum
        * 150-200% FTP: 30-60 seconds maximum
        * 200-300% FTP: 15-30 seconds maximum
        * Above 300% FTP: 5-15 seconds maximum
      - If this is a sprint workout, create segments with the "sprint" type that have very high intensity (up to 500% of FTP) for very short durations (5-15 seconds)
      - Mix sprint segments with adequate recovery periods
      - Sprint workouts should focus on maximum power output for very short durations
      - For sprint segments, set the duration as a decimal value of minutes: 0.167 for 10 seconds (10/60)
      - High-intensity intervals (>150% FTP) must have short durations that are physiologically realistic
      - For ${intensity.toLowerCase()} intensity, make the workout ${intensity === 'EASY' ? 'shorter and less intense' : intensity === 'HARD' ? 'longer and more challenging' : 'balanced in duration and intensity'}
    `

    console.log(`Generating workout for ${planType} plan, week ${week + 1}, day ${dayOfWeek + 1}, intensity: ${intensity}`);
    
    // Add a timeout to prevent hanging indefinitely
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI request timed out after 20 seconds')), 20000);
    });

    // Make the actual OpenAI request
    const openaiPromise = openai.chat.completions.create({
      model: 'gpt-3.5-turbo-1106',
      messages: [
        { role: 'system', content: 'You are a professional cycling coach creating training plans.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Race between the timeout and the actual request
    const response = await Promise.race([openaiPromise, timeoutPromise]) as any;
    
    console.log('Received response from OpenAI');
    
    if (!response.choices || !response.choices[0] || !response.choices[0].message || !response.choices[0].message.content) {
      console.error('Invalid response format from OpenAI:', response);
      throw new Error('Invalid response format from OpenAI');
    }
    
    // Validate and fix workouts with unrealistic intensity/duration combinations
    const validateAndFixWorkout = (workout: any) => {
      if (!workout.segments) return workout;
      
      console.log('Validating workout segments for physiological limitations');
      let wasFixed = false;
      
      // Apply intensity modifiers based on selected intensity level
      const correctedSegments = workout.segments.map((segment: any) => {
        let intensity = Number(segment.intensity);
        let duration = Number(segment.duration);
        const originalDuration = duration;
        const originalIntensity = intensity;
        
        // Apply intensity offset based on selected level
        intensity = Math.max(30, Math.min(500, intensity + intensityOffset));
        
        // Apply durationModifier to all non-warmup/cooldown segments
        if (segment.type !== 'warmup' && segment.type !== 'cooldown') {
          duration = duration * durationModifier;
        }
        
        // Apply physiologically appropriate limits based on intensity
        // Convert minutes to seconds for easier comparison
        const durationInSeconds = duration * 60;
        
        if (intensity > 300) { // >300% FTP
          const maxDurationSeconds = 15; // Max 15 seconds at this intensity
          if (durationInSeconds > maxDurationSeconds) {
            duration = maxDurationSeconds / 60; // Convert back to minutes
            wasFixed = true;
            console.log(`Corrected segment: ${intensity}% FTP from ${originalDuration} min to ${duration} min (${maxDurationSeconds} sec)`);
          }
        }
        else if (intensity > 200) { // 200-300% FTP
          const maxDurationSeconds = 30; // Max 30 seconds at this intensity
          if (durationInSeconds > maxDurationSeconds) {
            duration = maxDurationSeconds / 60; // Convert back to minutes
            wasFixed = true;
            console.log(`Corrected segment: ${intensity}% FTP from ${originalDuration} min to ${duration} min (${maxDurationSeconds} sec)`);
          }
        }
        else if (intensity > 150) { // 150-200% FTP
          const maxDurationSeconds = 60; // Max 60 seconds at this intensity
          if (durationInSeconds > maxDurationSeconds) {
            duration = maxDurationSeconds / 60; // Convert back to minutes
            wasFixed = true;
            console.log(`Corrected segment: ${intensity}% FTP from ${originalDuration} min to ${duration} min (${maxDurationSeconds} sec)`);
          }
        }
        else if (intensity > 120) { // 120-150% FTP
          const maxDurationSeconds = 300; // Max 5 minutes at this intensity
          if (durationInSeconds > maxDurationSeconds) {
            duration = maxDurationSeconds / 60; // Convert back to minutes
            wasFixed = true;
            console.log(`Corrected segment: ${intensity}% FTP from ${originalDuration} min to ${duration} min (${maxDurationSeconds} sec)`);
          }
        }
        
        if (intensity !== originalIntensity) {
          console.log(`Adjusted intensity from ${originalIntensity}% to ${intensity}% based on ${intensity} level`);
        }
        
        return {
          ...segment,
          duration,
          intensity
        };
      });
      
      // Recalculate total duration based on corrected segments
      const totalDuration = correctedSegments.reduce((acc: number, segment: any) => acc + Number(segment.duration), 0);
      
      if (wasFixed) {
        console.log(`Fixed workout with unrealistic intensity/duration combinations. New total duration: ${totalDuration} minutes`);
      } else {
        console.log('No segments needed correction for intensity/duration');
      }
      
      return {
        ...workout,
        segments: correctedSegments,
        duration: totalDuration
      };
    };
    
    let workoutData;
    try {
      workoutData = JSON.parse(response.choices[0].message.content);
      console.log('Parsed workout data from OpenAI, now validating intensity/duration combinations');
      // Apply validation to fix any unrealistic workouts
      workoutData = validateAndFixWorkout(workoutData);
      console.log('Successfully validated and parsed workout data from OpenAI');
    } catch (parseError) {
      console.error('Failed to parse JSON from OpenAI response:', response.choices[0].message.content);
      throw new Error('Failed to parse JSON from OpenAI response');
    }
    
    return {
      name: workoutData.name || 'Workout',
      description: workoutData.description || 'A cycling workout',
      duration: workoutData.duration || 60,
      segments: workoutData.segments || [],
    }
  } catch (error) {
    console.error('Error generating workout with AI:', error);
    console.log('Using fallback workout data instead');
    
    // Adjust fallback workout parameters based on intensity
    let fallbackDuration = 60; // Default for MEDIUM
    let fallbackIntensity = 0; // Adjustment to intensities
    
    if (intensity === 'EASY') {
      fallbackDuration = 45;
      fallbackIntensity = -10;
    } else if (intensity === 'HARD') {
      fallbackDuration = 75;
      fallbackIntensity = 5;
    }
    
    // Determine if this should be a sprint workout (randomly, but more likely in power plans)
    const shouldIncludeSprint = planType === 'POWER' && Math.random() > 0.7;
    
    // Fallback to a basic workout if AI generation fails
    if (shouldIncludeSprint) {
      return {
        name: `Sprint Power Workout (${intensity.charAt(0) + intensity.slice(1).toLowerCase()})`,
        description: 'A high-intensity sprint workout to improve your maximum power output',
        duration: Math.round(45 * (intensity === 'EASY' ? 0.8 : intensity === 'HARD' ? 1.2 : 1.0)),
        segments: [
          {
            type: 'warmup',
            duration: 10,
            intensity: 60,
            description: 'Easy pedaling to warm up thoroughly before sprint efforts'
          },
          {
            type: 'interval',
            duration: 5,
            intensity: 85 + fallbackIntensity,
            description: 'Moderate effort to prepare for sprint intervals'
          },
          {
            type: 'sprint',
            duration: 0.167, // 10 seconds (10/60)
            intensity: 350 + fallbackIntensity,
            description: 'Maximum effort sprint'
          },
          {
            type: 'recovery',
            duration: 4,
            intensity: 50,
            description: 'Easy spinning to recover'
          },
          {
            type: 'sprint',
            duration: 0.167, // 10 seconds (10/60)
            intensity: 400 + fallbackIntensity,
            description: 'Maximum effort sprint'
          },
          {
            type: 'recovery',
            duration: 4,
            intensity: 50,
            description: 'Easy spinning to recover'
          },
          {
            type: 'sprint',
            duration: 0.167, // 10 seconds (10/60)
            intensity: 450 + fallbackIntensity,
            description: 'Maximum effort sprint'
          },
          {
            type: 'recovery',
            duration: 4,
            intensity: 50,
            description: 'Easy spinning to recover'
          },
          {
            type: 'sprint',
            duration: 0.167, // 10 seconds (10/60)
            intensity: 500 + fallbackIntensity,
            description: 'Final maximum effort sprint'
          },
          {
            type: 'recovery',
            duration: 7,
            intensity: 45,
            description: 'Easy spinning to recover'
          },
          {
            type: 'cooldown',
            duration: 10,
            intensity: 40,
            description: 'Easy pedaling to cool down'
          }
        ],
      };
    } else {
      return {
        name: `${planType === 'POWER' ? 'Power' : 'Endurance'} Workout (${intensity.charAt(0) + intensity.slice(1).toLowerCase()})`,
        description: 'A basic cycling workout to improve your fitness',
        duration: fallbackDuration,
        segments: [
          {
            type: 'warmup',
            duration: 10,
            intensity: 50,
            description: 'Easy pedaling to warm up'
          },
          {
            type: 'interval',
            duration: fallbackDuration - 20,
            intensity: 75 + fallbackIntensity,
            description: 'Steady effort at moderate intensity'
          },
          {
            type: 'cooldown',
            duration: 10,
            intensity: 50,
            description: 'Easy pedaling to cool down'
          }
        ],
      };
    }
  }
} 