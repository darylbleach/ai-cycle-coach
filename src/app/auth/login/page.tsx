'use client'

// This export prevents Next.js from trying to statically generate this page during build
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Check for error in URL (from OAuth redirect)
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      let errorMessage = 'An error occurred during sign in'
      
      // Provide more detailed messages for common errors
      switch (errorParam) {
        case 'OAuthSignin':
          errorMessage = 'Error starting the OAuth sign in process'
          break
        case 'OAuthCallback':
          errorMessage = 'Error during the OAuth callback'
          break
        case 'OAuthCreateAccount':
          errorMessage = 'Error creating a user from the OAuth provider'
          break
        case 'EmailCreateAccount':
          errorMessage = 'Error creating a user from email provider'
          break
        case 'Callback':
          errorMessage = 'Error in the OAuth callback handler'
          break
        case 'AccessDenied':
          errorMessage = 'You do not have permission to sign in'
          break
        case 'Verification':
          errorMessage = 'The verification token has expired or is invalid'
          break
        default:
          errorMessage = `Authentication error: ${errorParam}`
      }
      
      setError(errorMessage)
      
      // Clean up the URL
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }
  }, [searchParams])

  // Security check - detect and handle credentials in URL
  useEffect(() => {
    // Check if email or password are in URL parameters
    const emailParam = searchParams.get('email')
    const passwordParam = searchParams.get('password')
    
    if (emailParam || passwordParam) {
      console.error('Security warning: Credentials detected in URL parameters')
      setError('For security reasons, please enter your credentials in the form below instead of using URL parameters')
      
      // Redirect to clean URL if credentials were found in URL
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, document.title, cleanUrl)
      }
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Ensure we're using POST with credentials in body, not URL
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
        callbackUrl: '/dashboard',
      })

      if (result?.error) {
        console.error('Login error:', result.error)
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Login exception:', error)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }
  
  const handleGoogleSignIn = () => {
    setError(null)
    setLoading(true)
    
    // Use redirect: true to handle the OAuth flow properly
    signIn('google', { 
      callbackUrl: '/dashboard',
      redirect: true 
    })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Sign in to your account
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link
            href="/auth/register"
            className="font-medium text-primary-600 hover:text-primary-500"
          >
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
          
          <div className="space-y-6">
            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" 
                  fill="#4285F4"/>
                <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" 
                  fill="#34A853" clipPath="polygon(0 0, 24 0, 24 24, 0 24)"/>
                <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" 
                  fill="#FBBC05" clipPath="polygon(0 0, 24 0, 24 24, 0 24)"/>
                <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" 
                  fill="#EA4335" clipPath="polygon(0 0, 24 0, 24 24, 0 24)"/>
              </svg>
              Sign in with Google
            </button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>
          </div>
          
          <form className="space-y-6 mt-6" onSubmit={handleSubmit} method="POST">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Email address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Password
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-70"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
} 