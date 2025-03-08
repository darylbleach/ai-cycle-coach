'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

export default function SettingsPage() {
  const { data: session, update, status } = useSession()
  const [ftp, setFtp] = useState<number>(session?.user?.ftp || 200)
  const [isUpdating, setIsUpdating] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [garminUsername, setGarminUsername] = useState('')
  const [garminPassword, setGarminPassword] = useState('')
  const [isConnectingGarmin, setIsConnectingGarmin] = useState(false)
  const [garminMessage, setGarminMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [isGarminConnected, setIsGarminConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDisconnectingGarmin, setIsDisconnectingGarmin] = useState(false)
  const router = useRouter()

  // Load initial data
  useEffect(() => {
    // Check if user has a Garmin account connected
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

    if (session?.user?.id) {
      checkGarminConnection()
      if (session?.user?.ftp) {
        console.log('Setting FTP from session:', session.user.ftp)
        setFtp(session.user.ftp)
      }
    }
  }, [session?.user?.id, session?.user?.ftp])

  const handleUpdateFtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)
    setMessage(null)

    try {
      console.log('Updating FTP to:', ftp)
      const response = await fetch('/api/user/update-ftp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ftp }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error updating FTP:', errorData)
        throw new Error(errorData.message || 'Failed to update FTP')
      }

      const result = await response.json()
      console.log('FTP update response:', result)

      // Update the session
      await update({ ftp })
      console.log('Session updated with new FTP:', ftp)

      setMessage({
        text: 'FTP updated successfully',
        type: 'success',
      })
      
      // Force update the local FTP state
      setFtp(ftp)
    } catch (error) {
      console.error('FTP update error:', error)
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to update FTP',
        type: 'error',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleConnectGarmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsConnectingGarmin(true)
    setGarminMessage(null)

    if (!session || !session.user?.id) {
      setGarminMessage({
        text: 'Not authenticated. Please try logging out and back in.',
        type: 'error',
      });
      setIsConnectingGarmin(false);
      return;
    }

    try {
      const response = await fetch('/api/garmin/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: garminUsername,
          password: garminPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to connect Garmin account')
      }

      setGarminMessage({
        text: data.message || 'Garmin account connected successfully',
        type: 'success',
      })

      setIsGarminConnected(true)
      setGarminUsername('')
      setGarminPassword('')
    } catch (error: any) {
      setGarminMessage({
        text: error.message || 'Failed to connect Garmin account',
        type: 'error',
      })
    } finally {
      setIsConnectingGarmin(false)
    }
  }

  const handleSyncGarminData = async () => {
    setIsSyncing(true)
    setGarminMessage(null)

    if (!session || !session.user?.id) {
      setGarminMessage({
        text: 'Not authenticated. Please try logging out and back in.',
        type: 'error',
      });
      setIsSyncing(false);
      return;
    }

    try {
      const response = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0], // Today's date
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to sync Garmin data')
      }

      setGarminMessage({
        text: data.message || 'Garmin data synced successfully',
        type: 'success',
      })

      // Show a toast notification
      toast.success('Garmin data synced successfully');
      
      // Use router to refresh the page after successful sync
      // This will fetch fresh data from the server
      router.refresh();
    } catch (error: any) {
      setGarminMessage({
        text: error.message || 'Failed to sync Garmin data',
        type: 'error',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDisconnectGarmin = async () => {
    setIsDisconnectingGarmin(true);
    setGarminMessage(null);

    if (!session || !session.user?.id) {
      setGarminMessage({
        text: 'Not authenticated. Please try logging out and back in.',
        type: 'error',
      });
      setIsDisconnectingGarmin(false);
      return;
    }

    try {
      const response = await fetch('/api/garmin/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to disconnect Garmin account');
      }

      setGarminMessage({
        text: data.message || 'Garmin account disconnected successfully',
        type: 'success',
      });

      setIsGarminConnected(false);
    } catch (error: any) {
      setGarminMessage({
        text: error.message || 'Failed to disconnect Garmin account',
        type: 'error',
      });
    } finally {
      setIsDisconnectingGarmin(false);
    }
  };

  // Add a debug function
  const debugSession = async () => {
    try {
      const response = await fetch('/api/debug/session');
      const data = await response.json();
      
      setMessage({
        text: `Session debug info logged to console. Server auth: ${data.isAuthenticated}, Has user ID: ${data.hasUserId}`,
        type: data.hasUserId ? 'success' : 'error'
      });
    } catch (error) {
      console.error('Error checking server session:', error);
      setMessage({
        text: 'Error checking server session, see console',
        type: 'error'
      });
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setMessage(null)

    if (!session || !session.user?.id) {
      setMessage({
        text: 'Not authenticated. Please try logging out and back in.',
        type: 'error',
      })
      setIsDeleting(false)
      setShowDeleteConfirmation(false)
      return
    }

    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error deleting account:', errorData)
        throw new Error(errorData.message || 'Failed to delete account')
      }

      const result = await response.json()
      console.log('Account deleted successfully:', result)

      // Show success message and close the modal
      setMessage({
        text: 'Account deleted successfully. Redirecting to login page...',
        type: 'success',
      })
      setShowDeleteConfirmation(false)

      // Short delay before redirecting to give user time to see the success message
      setTimeout(() => {
        // Sign out from NextAuth
        signOut({ redirect: false })
          .then(() => {
            // Redirect to login page
            router.push('/auth/login')
          })
          .catch(error => {
            console.error('Error signing out after account deletion:', error)
            // Redirect anyway even if sign out fails
            router.push('/auth/login')
          })
      }, 2000)
    } catch (error) {
      console.error('Account deletion error:', error)
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to delete account',
        type: 'error',
      })
      setShowDeleteConfirmation(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Profile Settings</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  value={session?.user?.name || ''}
                  disabled
                />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  value={session?.user?.email || ''}
                  disabled
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Training Settings</h2>
          {message && (
            <div
              className={`mb-4 rounded-md p-4 ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}
          <form onSubmit={handleUpdateFtp}>
            <div className="space-y-4">
              <div>
                <label htmlFor="ftp" className="block text-sm font-medium text-gray-700">
                  Functional Threshold Power (FTP)
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    id="ftp"
                    name="ftp"
                    min="50"
                    max="500"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    value={ftp}
                    onChange={(e) => setFtp(parseInt(e.target.value))}
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Your FTP is used to calculate training zones for your workouts
                </p>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="inline-flex items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-75"
                >
                  {isUpdating ? 'Updating...' : 'Update FTP'}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Garmin Connection</h2>
          {garminMessage && (
            <div
              className={`mb-4 rounded-md p-4 ${
                garminMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {garminMessage.text}
            </div>
          )}
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Connect your Garmin account to automatically sync your health data
            </p>
            
            {isGarminConnected ? (
              <div>
                <div className="mb-4 flex items-center space-x-2 text-sm text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Garmin account connected</span>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleSyncGarminData}
                    disabled={isSyncing}
                    className="inline-flex items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-75"
                  >
                    {isSyncing ? 'Syncing...' : 'Sync Health Data Now'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGarmin}
                    disabled={isDisconnectingGarmin}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-75"
                  >
                    {isDisconnectingGarmin ? 'Disconnecting...' : 'Disconnect Account'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConnectGarmin} className="space-y-4">
                <div>
                  <label htmlFor="garminUsername" className="block text-sm font-medium text-gray-700">
                    Garmin Username
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="garminUsername"
                      value={garminUsername}
                      onChange={(e) => setGarminUsername(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="garminPassword" className="block text-sm font-medium text-gray-700">
                    Garmin Password
                  </label>
                  <div className="mt-1">
                    <input
                      type="password"
                      id="garminPassword"
                      value={garminPassword}
                      onChange={(e) => setGarminPassword(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Your credentials are only used to authenticate with Garmin and are not stored on our servers.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isConnectingGarmin}
                  className="inline-flex items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-75"
                >
                  {isConnectingGarmin ? 'Connecting...' : 'Connect Garmin Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 border-t pt-8">
        <h2 className="text-xl font-semibold mb-4">Debug Tools</h2>
        <button
          type="button"
          onClick={debugSession}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Debug Session State
        </button>
        <p className="text-sm text-gray-500 mt-2">
          If you're experiencing authentication issues, click this button and check the browser console logs.
        </p>
      </div>

      <div className="mt-12 border-t pt-8">
        <h2 className="text-xl font-semibold mb-4 text-red-600">Danger Zone</h2>
        <div className="bg-red-50 border border-red-200 rounded-md p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2">Delete Account</h3>
          <p className="text-sm text-red-600 mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteConfirmation(true)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Account Deletion</h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to delete your account? This will permanently erase all your data, including:
            </p>
            <ul className="list-disc pl-5 mb-4 text-sm text-gray-500">
              <li>Your profile information</li>
              <li>All training plans</li>
              <li>Workout history</li>
              <li>Health metrics</li>
              <li>Connected accounts (Garmin, etc.)</li>
            </ul>
            <p className="text-sm text-gray-500 mb-4">
              This action <span className="font-bold">cannot be undone</span>.
            </p>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmation(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-75"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 