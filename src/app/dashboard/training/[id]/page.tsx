'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { format, parseISO } from 'date-fns'

interface Segment {
  type: string
  duration: number
  intensity: number
  description: string
}

interface Workout {
  id: string
  trainingPlanId: string
  name: string
  description: string
  date: string
  duration: number
  segments: Segment[]
  completed: boolean
}

interface TrainingPlan {
  id: string
  name: string
  type: string
  daysPerWeek: number
  restDays: number[]
  startDate: string
  endDate: string
  isActive: boolean
  intensity: string
  workouts: Workout[]
}

export default function TrainingPlanDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTrainingPlan = async () => {
      if (!session?.user) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/training/plans?planId=${params.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch training plan');
        }
        
        const data = await response.json();
        setTrainingPlan(data.trainingPlan);
      } catch (error) {
        console.error('Error fetching training plan:', error);
        setError('Failed to load training plan. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTrainingPlan();
  }, [session, params.id]);

  const formatIntensity = (intensity: string) => {
    switch (intensity) {
      case 'EASY':
        return { label: 'Easy', color: 'bg-green-100 text-green-800' };
      case 'MEDIUM':
        return { label: 'Medium', color: 'bg-blue-100 text-blue-800' };
      case 'HARD':
        return { label: 'Hard', color: 'bg-red-100 text-red-800' };
      default:
        return { label: 'Medium', color: 'bg-blue-100 text-blue-800' };
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    return `${format(parseISO(startDate), 'MMM d, yyyy')} - ${format(parseISO(endDate), 'MMM d, yyyy')}`;
  };

  const displayPercentage = (intensity: number): string => {
    // If intensity is already a percentage (e.g., 50, 90, 105)
    if (intensity >= 1 && intensity <= 500) {
      return intensity.toFixed(0);
    } 
    // If intensity is a decimal (e.g., 0.5, 0.9, 1.05)
    else if (intensity > 0 && intensity < 1) {
      return (intensity * 100).toFixed(0);
    }
    // In case of extremely high values, just display as is
    return intensity.toFixed(0);
  };

  const calculateWatts = (intensity: number, ftp: number): number => {
    // If intensity is already a percentage (e.g., 50, 90, 105)
    if (intensity >= 1 && intensity <= 500) {
      return Math.round(intensity * ftp / 100);
    } 
    // If intensity is a decimal (e.g., 0.5, 0.9, 1.05)
    else if (intensity > 0 && intensity < 1) {
      return Math.round(intensity * 100 * ftp / 100);
    }
    // For edge cases, use the raw value
    return Math.round(intensity * ftp / 100);
  };

  const formatDuration = (duration: number, intensity: number = 0): string => {
    // If intensity is over 110% FTP, always show in seconds for clarity
    if (intensity > 110) {
      const seconds = Math.round(duration * 60);
      return `${seconds} sec`;
    }
    // If duration is less than 1 minute, convert to seconds
    else if (duration < 1) {
      const seconds = Math.round(duration * 60);
      return `${seconds} sec`;
    }
    // If duration has decimal part, format with one decimal place
    else if (duration % 1 !== 0) {
      return `${duration.toFixed(1)} min`;
    }
    // Otherwise, format as whole minutes
    return `${duration} min`;
  };

  // Group workouts by week
  const groupWorkoutsByWeek = (workouts: Workout[]) => {
    const sorted = [...workouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const grouped: { week: number; workouts: Workout[] }[] = [];
    
    if (sorted.length === 0) return grouped;
    
    const startDate = parseISO(trainingPlan?.startDate || sorted[0].date);
    
    sorted.forEach(workout => {
      const workoutDate = parseISO(workout.date);
      const diffTime = Math.abs(workoutDate.getTime() - startDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekNumber = Math.floor(diffDays / 7) + 1;
      
      // Find or create week group
      let weekGroup = grouped.find(g => g.week === weekNumber);
      if (!weekGroup) {
        weekGroup = { week: weekNumber, workouts: [] };
        grouped.push(weekGroup);
      }
      
      weekGroup.workouts.push(workout);
    });
    
    return grouped;
  };

  // SendToGarmin component
  const SendToGarminButton = ({ workout }: { workout: Workout }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleSendToGarmin = async () => {
      setIsLoading(true);
      try {
        // Get user's FTP or use default value
        const userFTP = session?.user?.ftp || 200;

        // Convert workout to Garmin format
        const garminWorkout = {
          workoutName: workout.name,
          description: workout.description || `Workout on ${workout.date}`,
          sportType: { sportTypeId: 2, sportTypeKey: 'cycling' },
          workoutSegments: [{
            segmentOrder: 1,
            sportType: { sportTypeId: 2, sportTypeKey: 'cycling' },
            workoutSteps: workout.segments.map((segment, index) => {
              // Calculate actual power in watts based on intensity percentage and FTP
              const powerWatts = calculateWatts(segment.intensity, userFTP);
              
              return {
                type: 'ExecutableStepDTO',
                stepOrder: index + 1,
                stepType: { stepTypeId: 3, stepTypeKey: 'interval' },
                childStepId: null,
                endCondition: { conditionTypeId: 2, conditionTypeKey: 'time' },
                endConditionValue: segment.duration * 60, // Convert to seconds
                targetType: { workoutTargetTypeId: 2, workoutTargetTypeKey: 'power' },
                targetValueOne: powerWatts - 5, // Lower bound in watts
                targetValueTwo: powerWatts + 5, // Upper bound in watts
              };
            }),
          }],
        };

        const response = await fetch('/api/garmin/upload-workout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workoutData: garminWorkout,
            workoutName: workout.name,
          }),
        });

        const data = await response.json();
        setResult({
          success: response.ok,
          message: data.message,
        });
      } catch (error) {
        setResult({
          success: false,
          message: 'Failed to send workout to Garmin',
        });
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <>
        <button
          onClick={handleSendToGarmin}
          disabled={isLoading}
          className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          {isLoading ? 'Sending...' : 'Send to Garmin'}
        </button>
        
        {result && (
          <div className={`mt-2 p-2 text-sm rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {result.message}
          </div>
        )}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !trainingPlan) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center">
        <h2 className="text-lg font-medium text-red-800 mb-2">Error Loading Training Plan</h2>
        <p className="text-red-700">{error || "Training plan not found"}</p>
        <button 
          onClick={() => router.push('/dashboard/training')}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Back to Training Plans
        </button>
      </div>
    );
  }

  const weeklyWorkouts = groupWorkoutsByWeek(trainingPlan.workouts);

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{trainingPlan.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800">
              {trainingPlan.daysPerWeek} days/week
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
              {formatDateRange(trainingPlan.startDate, trainingPlan.endDate)}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${formatIntensity(trainingPlan.intensity).color}`}>
              {formatIntensity(trainingPlan.intensity).label} Intensity
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard/training')}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Back to Plans
        </button>
      </div>

      <div className="space-y-8">
        {weeklyWorkouts.map((week) => (
          <div key={week.week} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Week {week.week}</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {week.workouts.map((workout) => (
                <div key={workout.id} className="p-4">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 w-24">
                          {format(parseISO(workout.date), 'EEE, MMM d')}
                        </span>
                        <h3 className="text-lg font-medium text-gray-900">{workout.name}</h3>
                        {workout.completed && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            Completed
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{workout.description}</p>
                      <p className="mt-1 text-sm text-gray-700">
                        Duration: {formatDuration(workout.duration)}
                      </p>
                    </div>
                    <div className="mt-2 md:mt-0 flex items-center space-x-2">
                      <button
                        onClick={() => {
                          // Toggle completed status
                          // This would need an API endpoint implementation
                          console.log('Toggle workout completion:', workout.id);
                        }}
                        className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                          workout.completed
                            ? 'border border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                            : 'border border-primary-300 text-primary-700 bg-primary-50 hover:bg-primary-100'
                        }`}
                      >
                        {workout.completed ? 'Completed' : 'Mark Complete'}
                      </button>
                      <SendToGarminButton workout={workout} />
                    </div>
                  </div>
                  
                  {/* Workout Segments */}
                  <div className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {workout.segments.map((segment, index) => (
                        <div key={index} className="rounded-md bg-gray-50 p-3">
                          <div className="flex justify-between">
                            <span className={`text-sm font-medium capitalize ${
                              segment.type === 'sprint' ? 'text-red-600 font-bold' : ''
                            }`}>
                              {segment.type}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatDuration(segment.duration, segment.intensity)} at {displayPercentage(segment.intensity)}% FTP 
                              ({calculateWatts(segment.intensity, session?.user?.ftp || 200)} watts)
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{segment.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 