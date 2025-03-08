import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import Link from 'next/link'

export default async function Home() {
  const session = await getServerSession()

  // If user is logged in, redirect to dashboard
  if (session) {
    redirect('/dashboard')
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
      <div className="container max-w-4xl px-4 py-16 text-center">
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
          <span className="text-primary-500">AI-Powered</span> Cycling Coach
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-xl text-gray-500">
          Personalized training plans that adapt to your performance and recovery. Connect your Garmin device and get AI-powered insights to improve your cycling.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/register"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary-600 px-8 text-base font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Get Started Free
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-gray-300 bg-white px-8 text-base font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300"
          >
            Sign In
          </Link>
        </div>
      </div>
      <div className="container mb-16 max-w-5xl px-4">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 text-primary-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold">Smart Training Plans</h3>
            <p className="text-gray-500">AI-generated plans that adapt to your progress and fitness level</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 text-primary-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold">Recovery Monitoring</h3>
            <p className="text-gray-500">Track sleep, body battery, and HRV to optimize training and recovery</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 text-primary-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="m16 8-8 8" />
                <path d="m8 8 8 8" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold">Garmin Integration</h3>
            <p className="text-gray-500">Seamlessly sync your Garmin data to inform your training decisions</p>
          </div>
        </div>
      </div>
    </main>
  )
} 