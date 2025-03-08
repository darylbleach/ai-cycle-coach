'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TrainingRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/training')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Redirecting...</p>
    </div>
  )
} 