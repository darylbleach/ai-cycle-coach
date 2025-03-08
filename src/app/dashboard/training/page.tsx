'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

type TrainingPlanType = 'POWER' | 'FITNESS'
type IntensityLevel = 'EASY' | 'MEDIUM' | 'HARD'

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

export default function TrainingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'plans' | 'calendar'>('plans')
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)
  const [planType, setPlanType] = useState<TrainingPlanType>('POWER')
  const [intensity, setIntensity] = useState<IntensityLevel>('MEDIUM')
  const [daysPerWeek, setDaysPerWeek] = useState(3)
  const [restDays, setRestDays] = useState<number[]>([0, 6]) // Sunday and Saturday
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [planDuration, setPlanDuration] = useState<number>(4) // 4 weeks by default
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([])
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)

  // Plan creation states
  const [planName, setPlanName] = useState('')
  const [creationProgress, setCreationProgress] = useState(0)
  const [creationStatus, setCreationStatus] = useState('')

  // Define fetchTrainingPlans outside of useEffect
  const fetchTrainingPlans = async () => {
    if (!session?.user) return;
    
    try {
      const response = await fetch('/api/training/plans');
      if (response.ok) {
        const data = await response.json();
        setTrainingPlans(data.trainingPlans);
      }
    } catch (error) {
      console.error('Error fetching training plans:', error);
    }
  };

  // Use the function in useEffect
  useEffect(() => {
    if (session?.user) {
      fetchTrainingPlans();
    }
  }, [session]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!session || !session.user) {
      setError('You must be logged in to create a training plan')
      return
    }
    
    setIsLoading(true)
    setError(null)
    setCreationProgress(0)
    setCreationStatus('Initializing plan creation...')
    
    try {
      // Start progress tracking
      const progressInterval = setInterval(() => {
        setCreationProgress((prev) => {
          // Only increment up to 95% - the last 5% will be set when we get the response
          if (prev < 95) {
            const newProgress = prev + Math.random() * 3;
            
            // Update status message based on progress
            if (newProgress > 80) {
              setCreationStatus('Finalizing workouts and saving to database...');
            } else if (newProgress > 60) {
              setCreationStatus('Generating sprint and specialty workouts...');
            } else if (newProgress > 30) {
              setCreationStatus('Creating basic workout structure...');
            } else if (newProgress > 10) {
              setCreationStatus('Analyzing training data...');
            }
            
            return Math.min(newProgress, 95);
          }
          return prev;
        });
      }, 800);
      
      const response = await fetch('/api/training/create-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: planName,
          type: planType,
          daysPerWeek,
          restDays,
          duration: planDuration,
          startDate: startDate.toISOString(),
          intensity,
        }),
      })
      
      // Clear the interval once we get a response
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create training plan')
      }
      
      setCreationProgress(100);
      setCreationStatus('Plan created successfully!');
      
      // Fetch updated plans
      fetchTrainingPlans()
      
      // Reset form and close modal
      setPlanName('')
      setPlanType('POWER')
      setIntensity('MEDIUM')
      setDaysPerWeek(3)
      setRestDays([0, 6])
      setPlanDuration(4)
      setIsCreatingPlan(false)
    } catch (error: any) {
      console.error('Error creating training plan:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
      // Reset progress after a delay
      setTimeout(() => {
        setCreationProgress(0);
        setCreationStatus('');
      }, 2000);
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this training plan? This will remove all workouts associated with it.')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/training/plans?planId=${planId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete training plan');
      }
      
      // Remove the deleted plan from state
      setTrainingPlans(trainingPlans.filter(plan => plan.id !== planId));
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRestDay = (day: number) => {
    if (restDays.includes(day)) {
      // Remove day if already selected
      setRestDays(restDays.filter((d) => d !== day))
    } else {
      // Add day if not selected and we haven't reached the maximum rest days
      if (restDays.length < 7 - daysPerWeek) {
        setRestDays([...restDays, day])
      }
    }
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Find workouts for the selected date
  const getWorkoutsForDate = (date: Date) => {
    const selectedDateStr = date.toISOString().split('T')[0];
    
    return trainingPlans.flatMap(plan => 
      plan.workouts.filter(workout => {
        const workoutDate = new Date(workout.date);
        return workoutDate.toISOString().split('T')[0] === selectedDateStr;
      })
    );
  };

  const selectedDateWorkouts = getWorkoutsForDate(selectedDate);

  // Use any type for the calendar value to bypass the type issues
  const handleDateChange = (value: any) => {
    if (value instanceof Date) {
      setSelectedDate(value);
    }
  };

  // Enhanced tile class for calendar to make workout days more obvious
  const getTileClassName = ({ date, view }: { date: Date; view: string }) => {
    const dateStr = date.toISOString().split('T')[0];
    const hasWorkout = trainingPlans.some(plan => 
      plan.workouts.some(workout => {
        const workoutDate = new Date(workout.date);
        return workoutDate.toISOString().split('T')[0] === dateStr;
      })
    );
    
    if (hasWorkout) {
      // Today's workout gets a special highlight
      const isToday = new Date().toISOString().split('T')[0] === dateStr;
      return isToday 
        ? 'bg-green-600 text-white font-bold rounded-full workout-day' 
        : 'bg-green-200 text-green-800 font-medium rounded-md workout-day';
    }
    
    return null;
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

  // Add a helper function to format the intensity for display
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Training</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your training plans and view your workout schedule
        </p>
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('plans')}
              className={`border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'plans'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Training Plans
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === 'calendar'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Calendar
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'plans' && (
        <div>
          {!isCreatingPlan ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Your Training Plans</h2>
                <button
                  onClick={() => setIsCreatingPlan(true)}
                  className="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                >
                  Create New Plan
                </button>
              </div>
              
              {trainingPlans.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {trainingPlans.map((plan) => (
                    <div key={plan.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-medium text-gray-900">{plan.name}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800">
                              {plan.daysPerWeek} days/week
                            </span>
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                              {new Date(plan.startDate).toLocaleDateString()} to {new Date(plan.endDate).toLocaleDateString()}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${formatIntensity(plan.intensity || 'MEDIUM').color}`}>
                              {formatIntensity(plan.intensity || 'MEDIUM').label} Intensity
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => router.push(`/dashboard/training/${plan.id}`)}
                            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md bg-gray-50 p-4 text-center text-gray-500">
                  <p>You don't have any active training plans.</p>
                  <p className="mt-2 text-sm">
                    Create a new training plan to get started with your workouts.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-medium text-gray-900">Create New Training Plan</h2>
              
              <form onSubmit={handleCreatePlan}>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Plan Type</label>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div
                        className={`flex cursor-pointer items-center justify-center rounded-md border p-4 ${
                          planType === 'POWER'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                        onClick={() => setPlanType('POWER')}
                      >
                        <div className="text-center">
                          <div className="font-medium">Power Plan</div>
                          <div className="mt-1 text-xs">Increase your FTP</div>
                        </div>
                      </div>
                      <div
                        className={`flex cursor-pointer items-center justify-center rounded-md border p-4 ${
                          planType === 'FITNESS'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                        onClick={() => setPlanType('FITNESS')}
                      >
                        <div className="text-center">
                          <div className="font-medium">Fitness Builder</div>
                          <div className="mt-1 text-xs">Improve endurance</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Workout Intensity</label>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      <div
                        className={`flex cursor-pointer items-center justify-center rounded-md border p-4 ${
                          intensity === 'EASY'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                        onClick={() => setIntensity('EASY')}
                      >
                        <div className="text-center">
                          <div className="font-medium">Easy</div>
                          <div className="mt-1 text-xs">Shorter, lower intensity</div>
                        </div>
                      </div>
                      <div
                        className={`flex cursor-pointer items-center justify-center rounded-md border p-4 ${
                          intensity === 'MEDIUM'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                        onClick={() => setIntensity('MEDIUM')}
                      >
                        <div className="text-center">
                          <div className="font-medium">Medium</div>
                          <div className="mt-1 text-xs">Balanced workouts</div>
                        </div>
                      </div>
                      <div
                        className={`flex cursor-pointer items-center justify-center rounded-md border p-4 ${
                          intensity === 'HARD'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                        onClick={() => setIntensity('HARD')}
                      >
                        <div className="text-center">
                          <div className="font-medium">Hard</div>
                          <div className="mt-1 text-xs">Longer, higher intensity</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Training Days Per Week
                    </label>
                    <select
                      value={daysPerWeek}
                      onChange={(e) => {
                        const newDaysPerWeek = parseInt(e.target.value)
                        setDaysPerWeek(newDaysPerWeek)
                        // Adjust rest days if needed
                        if (7 - newDaysPerWeek < restDays.length) {
                          setRestDays(restDays.slice(0, 7 - newDaysPerWeek))
                        }
                      }}
                      className="mt-2 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
                    >
                      <option value={3}>3 days</option>
                      <option value={4}>4 days</option>
                      <option value={5}>5 days</option>
                      <option value={6}>6 days</option>
                      <option value={7}>7 days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rest Days</label>
                    <p className="mt-1 text-sm text-gray-500">
                      Select {7 - daysPerWeek} days for rest
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {dayNames.map((day, index) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleRestDay(index)}
                          disabled={
                            !restDays.includes(index) && restDays.length >= 7 - daysPerWeek
                          }
                          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                            restDays.includes(index)
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          } ${
                            !restDays.includes(index) && restDays.length >= 7 - daysPerWeek
                              ? 'cursor-not-allowed opacity-50'
                              : ''
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                    <input
                      type="date"
                      value={startDate.toISOString().split('T')[0]}
                      onChange={(e) => setStartDate(new Date(e.target.value))}
                      className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="duration" className="mb-1 block text-sm font-medium text-gray-700">
                      Plan Duration (Weeks)
                    </label>
                    <select
                      id="duration"
                      value={planDuration}
                      onChange={(e) => setPlanDuration(parseInt(e.target.value))}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value={4}>4 weeks</option>
                      <option value={8}>8 weeks</option>
                      <option value={12}>12 weeks</option>
                      <option value={16}>16 weeks</option>
                      <option value={20}>20 weeks</option>
                      <option value={24}>24 weeks</option>
                    </select>
                  </div>

                  {/* Progress indicator */}
                  {isLoading && (
                    <div className="mb-6">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">Creating Plan...</span>
                        <span className="text-sm font-medium text-gray-700">{creationProgress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-600 rounded-full transition-all duration-300 ease-in-out"
                          style={{ width: `${creationProgress}%` }}
                        ></div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{creationStatus}</p>
                    </div>
                  )}
                  
                  {error && (
                    <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsCreatingPlan(false)}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`inline-flex items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        isLoading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {isLoading ? 'Creating...' : 'Create Plan'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-medium text-gray-900">Training Calendar</h2>
              <style jsx global>{`
                .workout-day {
                  position: relative;
                  border: 2px solid #059669 !important;
                  overflow: visible !important;
                }
                .workout-day::after {
                  content: '🏋️';
                  position: absolute;
                  top: -3px;
                  right: -3px;
                  font-size: 11px;
                  z-index: 10;
                  background: white;
                  border-radius: 50%;
                  height: 16px;
                  width: 16px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                .react-calendar__tile--active.workout-day {
                  background: #047857 !important;
                  color: white !important;
                }
                .react-calendar__tile--now.workout-day {
                  background: #10b981 !important;
                  color: white !important;
                }
              `}</style>
              <Calendar 
                value={selectedDate} 
                onChange={handleDateChange} 
                className="w-full border-none"
                tileClassName={getTileClassName}
              />
              
              <div className="mt-4 flex items-center text-sm text-gray-600">
                <div className="flex items-center mr-4">
                  <div className="w-3 h-3 rounded-full bg-green-200 mr-1"></div>
                  <span>Workout Day</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-600 mr-1"></div>
                  <span>Today's Workout</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-medium text-gray-900">
                Workouts for {selectedDate.toLocaleDateString()}
              </h2>
              
              {selectedDateWorkouts.length > 0 ? (
                <div className="space-y-4">
                  {selectedDateWorkouts.map((workout) => (
                    <div key={workout.id} className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-lg font-medium text-gray-900">{workout.name}</h3>
                      <p className="mt-1 text-sm text-gray-500">{workout.description}</p>
                      <p className="mt-2 text-sm font-medium text-gray-700">
                        Duration: {formatDuration(workout.duration)}
                      </p>
                      
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900">Workout Segments</h4>
                        <div className="mt-2 space-y-2">
                          {workout.segments.map((segment, index) => (
                            <div key={index} className="rounded-md bg-gray-50 p-3">
                              <div className="flex justify-between">
                                <span className={`text-sm font-medium text-gray-900 capitalize ${
                                  segment.type === 'sprint' ? 'text-red-600 font-bold' : ''
                                }`}>
                                  {segment.type}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {formatDuration(segment.duration, segment.intensity)} at {displayPercentage(segment.intensity)}% FTP 
                                  ({Math.round(calculateWatts(segment.intensity, session?.user?.ftp || 200))} watts)
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
              ) : (
                <div className="rounded-md bg-gray-50 p-4 text-center text-gray-500">
                  <p>No workouts scheduled for this date.</p>
                  <p className="mt-2 text-sm">
                    Select a date with a highlighted workout or create a new training plan.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 