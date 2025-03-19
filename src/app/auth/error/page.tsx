'use client'

// This export prevents Next.js from trying to statically generate this page during build
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ErrorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorMessage, setErrorMessage] = useState<string>('An authentication error occurred')
  const [solution, setSolution] = useState<string | null>(null)

  useEffect(() => {
    const error = searchParams.get('error')
    
    // Map error codes to user-friendly messages
    if (error) {
      switch (error) {
        case 'CredentialsSignin':
          setErrorMessage('Invalid email or password. Please try again.')
          break
        case 'SessionRequired':
          setErrorMessage('You need to be signed in to access this page.')
          break
        case 'AccessDenied':
          setErrorMessage('Access denied. You do not have permission to access this resource.')
          break
        case 'OAuthSignin':
          setErrorMessage('There was a problem initiating the Google sign-in process.')
          setSolution('This may be due to an issue with your Google OAuth configuration. Make sure your redirect URLs are set up correctly in the Google Cloud Console.')
          break
        case 'OAuthCallback':
          setErrorMessage('There was a problem with the Google authentication callback.')
          setSolution('This often happens when the OAuth client ID or secret is incorrect, or when the redirect URL in Google Cloud Console doesn\'t match your application URL.')
          break
        case 'OAuthAccountNotLinked':
          setErrorMessage('Your Google account is not linked to an existing account.')
          setSolution('If you\'ve previously signed up with email and password, please sign in with those credentials first.')
          break
        case 'Configuration':
          setErrorMessage('There is a server configuration issue with the authentication system.')
          setSolution('This is likely due to missing or incorrect environment variables. Please contact support.')
          break
        case 'invalid_client':
          setErrorMessage('Google OAuth client not found or invalid client configuration.')
          setSolution('This error usually occurs when the Google OAuth client ID is incorrect or the application is not properly registered in Google Cloud Console.')
          break
        case 'Verification':
          setErrorMessage('The verification token has expired or is invalid')
          break
        default:
          setErrorMessage(`Authentication error: ${error}`)
      }
    }

    // Security check - make sure no sensitive data is in URL
    if (searchParams.get('email') || searchParams.get('password')) {
      console.error('Security warning: Sensitive data detected in error URL parameters')
      // Remove sensitive data from URL
      if (window.history && window.history.replaceState) {
        const cleanUrl = `${window.location.pathname}?error=${error || ''}`
        window.history.replaceState({}, document.title, cleanUrl)
      }
    }
  }, [searchParams])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Authentication Error
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Authentication Failed</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{errorMessage}</p>
                  {solution && (
                    <p className="mt-2 font-medium">Possible solution: {solution}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col space-y-4">
            <Link
              href="/auth/login"
              className="flex justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              Return to Login
            </Link>
            
            <Link
              href="/"
              className="flex justify-center rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-200"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <ErrorContent />
    </Suspense>
  )
} 