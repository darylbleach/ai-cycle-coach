'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

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
}

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
    return intensity * ftp / 100;
  } 
  // If intensity is a decimal (e.g., 0.5, 0.9, 1.05)
  else if (intensity > 0 && intensity < 1) {
    return intensity * 100 * ftp / 100;
  }
  // For edge cases, use the raw value
  return intensity * ftp / 100;
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

export default function DashboardPage() {
  const { data: session } = useSession()
  const [selectedTab, setSelectedTab] = useState('upcoming')
  const [isGarminConnected, setIsGarminConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [healthData, setHealthData] = useState<any>(null)
  const [error, setError] = useState<React.ReactNode | null>(null)
  const [trainingPlans, setTrainingPlans] = useState<any[]>([])
  const [upcomingWorkouts, setUpcomingWorkouts] = useState<Workout[]>([])

  // Check if user has a Garmin account connected
  useEffect(() => {
    const checkGarminConnection = async () => {
      try {
        const response = await fetch('/api/user/connected-accounts')
        if (response.ok) {
          const data = await response.json()
          setIsGarminConnected(data.accounts.some((account: any) => account.provider === 'garmin'))
        }
      } catch (error) {
        console.error('Error checking Garmin connection:', error)
      }
    }

    if (session?.user) {
      checkGarminConnection()
    }
  }, [session])

  // Check for health data for real-world date
  useEffect(() => {
    const fetchTodayHealthData = async () => {
      try {
        // Use today's date for getting the latest health data
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        
        console.log('Dashboard: Fetching health metrics for today:', formattedDate);
        
        // Fetch health data for today
        const response = await fetch(`/api/health/metrics?date=${formattedDate}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.healthMetric) {
            console.log('Dashboard: Received health metrics:', data.healthMetric);
            setHealthData(data.healthMetric);
          } else {
            console.log('Dashboard: No health metrics data available for today');
          }
        } else {
          console.error('Dashboard: Failed to fetch health metrics', response.status);
        }
      } catch (error) {
        console.error('Error fetching health data:', error);
      }
    }

    if (session?.user) {
      fetchTodayHealthData();
    }
  }, [session]);

  // Fetch training plans and upcoming workouts
  useEffect(() => {
    const fetchTrainingPlans = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/training/plans')
          const data = await response.json()

          if (!response.ok) {
            console.error('Failed to fetch training plans')
            return
          }

          setTrainingPlans(data.trainingPlans)
          
          // Get upcoming workouts
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          const upcoming = data.trainingPlans.flatMap((plan: any) => 
            plan.workouts.filter((workout: any) => {
              const workoutDate = new Date(workout.date)
              workoutDate.setHours(0, 0, 0, 0)
              return workoutDate >= today
            })
          )
          
          // Sort by date (closest first) and limit to 3
          upcoming.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          setUpcomingWorkouts(upcoming.slice(0, 3))
        } catch (error) {
          console.error('Error fetching training plans:', error)
        }
      }
    }

    fetchTrainingPlans()
  }, [session])

  const handleSyncData = async () => {
    if (!isGarminConnected) {
      setError('No Garmin account connected. Please connect your account in Settings.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Use current date for syncing the latest data
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      
      console.log('Dashboard: Syncing Garmin data for today:', formattedDate);

      const response = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send today's date in the request
        body: JSON.stringify({
          date: formattedDate,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to sync data')
      }

      const data = await response.json()
      console.log('Dashboard: Garmin sync response:', data);
      
      if (data.hasActualData === false) {
        console.log('Dashboard: Warning - Garmin returned no actual data');
        if (data.date !== formattedDate) {
          // If the API used a different date than we requested
          setError(`Garmin returned no health data for today (${formattedDate}). Tried alternative date (${data.date}) but still no data found.`);
        } else {
          setError(`Garmin returned no health data for today (${formattedDate}).`);
        }
      } else {
        // If we got actual data but for a different date than requested
        if (data.date !== formattedDate) {
          setError(`Found Garmin data for ${data.date} instead of today (${formattedDate}).`);
        } else {
          // Success notification
          setError(null);
          toast.success("Your Garmin data has been successfully synced.", {
            duration: 3000,
          });
        }
      }
      
      // Refresh health data for the date that was actually used in the sync
      const actualDateUsed = data.date || formattedDate;
      const healthResponse = await fetch(`/api/health/metrics?date=${actualDateUsed}`, {
        // Add cache control to ensure we get fresh data
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        if (healthData.healthMetric) {
          setHealthData(healthData.healthMetric)
          
          // If workouts were adjusted based on new health data, refresh those too
          if (data.workoutsAdjusted) {
            // Refresh training plans and workouts to show any adjustments
            const plansResponse = await fetch('/api/training/plans', {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache'
              }
            });
            if (plansResponse.ok) {
              const plansData = await plansResponse.json();
              setTrainingPlans(plansData.trainingPlans);
              
              // Update upcoming workouts based on fresh data
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              const upcoming = plansData.trainingPlans.flatMap((plan: any) => 
                plan.workouts.filter((workout: any) => {
                  const workoutDate = new Date(workout.date);
                  workoutDate.setHours(0, 0, 0, 0);
                  return workoutDate >= today;
                })
              );
              
              setUpcomingWorkouts(upcoming);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error syncing data:', error)
      
      // Check if this is a session expired error
      if (error.message?.includes('session has expired') || error.message?.includes('reconnect your Garmin account')) {
        setError(
          <>
            Your Garmin session has expired. Please{' '}
            <Link href="/dashboard/settings" className="font-medium text-primary-600 hover:text-primary-500">
              reconnect your Garmin account
            </Link>
            {' '}in settings.
          </>
        )
      } else {
        setError(error.message || 'Failed to sync data')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Get the user's FTP value
  const userFtp = session?.user?.ftp || 200

  // Get the active training plan if available
  const activePlan = trainingPlans.length > 0 ? trainingPlans[0] : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {session?.user?.name || 'Athlete'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Daily Stats Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Today's Recovery</h2>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Training Readiness</span>
                <span className="font-medium text-gray-900">
                  {healthData?.trainingReadiness ? `${healthData.trainingReadiness}/100` : 'No data'}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                <div 
                  className="h-2 rounded-full bg-primary-500" 
                  style={{ width: healthData?.trainingReadiness ? `${healthData.trainingReadiness}%` : '0%' }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Body Battery</span>
                <span className="font-medium text-gray-900">
                  {healthData?.bodyBattery ? `${healthData.bodyBattery}/100` : 'No data'}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                <div 
                  className="h-2 rounded-full bg-primary-500" 
                  style={{ width: healthData?.bodyBattery ? `${healthData.bodyBattery}%` : '0%' }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">HRV Status</span>
                <span className="font-medium text-gray-900">
                  {healthData?.hrv ? `${healthData.hrv.toFixed(1)} ms` : 'No data'}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Stress Level</span>
                <span className="font-medium text-gray-900">
                  {healthData?.avgStressLevel ? `${healthData.avgStressLevel}/100` : 'No data'}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                <div 
                  className="h-2 rounded-full bg-primary-500" 
                  style={{ width: healthData?.avgStressLevel ? `${healthData.avgStressLevel}%` : '0%' }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Resting Heart Rate</span>
                <span className="font-medium text-gray-900">
                  {healthData?.restingHeartRate ? `${healthData.restingHeartRate} bpm` : 'No data'}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Sleep Duration</span>
                <span className="font-medium text-gray-900">
                  {healthData?.sleepHours 
                    ? `${Math.floor(healthData.sleepHours)}h ${Math.round((healthData.sleepHours % 1) * 60)}m` 
                    : 'No data'}
                </span>
              </div>
              {healthData?.sleepScore && (
                <div className="mt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Sleep Score</span>
                    <span className="text-xs font-medium text-gray-700">
                      {healthData.sleepScore}/100
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full rounded-full bg-gray-200">
                    <div 
                      className="h-1 rounded-full bg-primary-500" 
                      style={{ width: `${healthData.sleepScore}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleSyncData}
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-75"
            >
              {isLoading ? 'Syncing...' : isGarminConnected ? 'Sync Garmin Data' : 'Connect Garmin Account'}
            </button>
            
            {!isGarminConnected && (
              <p className="mt-2 text-xs text-gray-500 text-center">
                Connect your Garmin account in{' '}
                <Link href="/dashboard/settings" className="text-primary-600 hover:text-primary-500">
                  Settings
                </Link>
              </p>
            )}
            {healthData?.syncedAt && (
              <p className="mt-2 text-xs text-gray-500 text-center">
                Last synced: {new Date(healthData.syncedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Training Status Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Training Status</h2>
          <div className="space-y-4">
            <div>
              <span className="text-sm text-gray-500">Current FTP</span>
              <div className="mt-1 flex items-end">
                <span className="text-3xl font-bold text-gray-900">
                  {userFtp}
                </span>
                <span className="ml-1 text-sm text-gray-500">watts</span>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500">Active Training Plan</span>
              <div className="mt-1">
                {activePlan ? (
                  <div>
                    <span className="text-gray-900 font-medium">{activePlan.name}</span>
                    <div className="text-sm text-gray-500">
                      {activePlan.type === 'POWER' ? 'Power' : 'Fitness'} - {activePlan.daysPerWeek} days/week
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-900">No active plan</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Link
              href="/dashboard/training"
              className="inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              {activePlan ? 'View Training Plan' : 'Create Training Plan'}
            </Link>
          </div>
        </div>

        {/* Upcoming Workout Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Next Workout</h2>
          <div className="flex h-full flex-col justify-between">
            {upcomingWorkouts.length > 0 ? (
              <div className="space-y-4">
                {upcomingWorkouts.map((workout, index) => (
                  <div key={workout.id} className={index > 0 ? "pt-3 border-t border-gray-100" : ""}>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium text-gray-900">{workout.name}</span>
                        <div className="text-sm text-gray-500 mt-1">{new Date(workout.date).toLocaleDateString()}</div>
                      </div>
                      <span className="text-sm text-gray-500">{formatDuration(workout.duration, workout.segments[0]?.intensity)}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">{workout.description}</p>
                    
                    {/* Display the first segment's power in absolute watts based on FTP */}
                    {workout.segments && workout.segments.length > 0 && (
                      <div className="mt-2 text-xs text-gray-700">
                        <div className="flex items-center space-x-2">
                          <span className={`capitalize ${
                            workout.segments[0].type === 'sprint' ? 'text-red-600 font-bold' : ''
                          }`}>{workout.segments[0].type}</span>
                          <span className="font-medium">{Math.round(calculateWatts(workout.segments[0].intensity, userFtp))} watts</span>
                          <span>({displayPercentage(workout.segments[0].intensity)}% FTP)</span>
                          <span>{formatDuration(workout.segments[0].duration, workout.segments[0].intensity)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-gray-500">No upcoming workouts</p>
                <p className="mt-4 text-sm text-gray-500">
                  Create a training plan to get started with your workouts.
                </p>
              </div>
            )}
            <div className="mt-6">
              <Link
                href="/dashboard/training"
                className="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300"
              >
                View Training Calendar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 