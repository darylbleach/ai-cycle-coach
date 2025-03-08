import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const prisma = new PrismaClient();

// Helper to count valid metrics in the data
function countValidMetrics(data: any): number {
  if (!data) return 0;
  
  let count = 0;
  if (data.trainingReadiness !== null) count++;
  if (data.sleepHours !== null) count++;
  if (data.bodyBattery !== null) count++;
  if (data.hrv !== null) count++;
  if (data.avgStressLevel !== null) count++;
  if (data.restingHeartRate !== null) count++;
  // We don't count VO2max as it's only available from real Garmin data
  
  return count;
}

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      console.log('Health Metrics: No authenticated user session', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!session?.user?.id
      });
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    
    // Default to today if no date is provided
    const date = dateParam 
      ? new Date(dateParam) 
      : new Date();
    
    // Normalize date to remove time component
    date.setHours(0, 0, 0, 0);

    // Get health metrics for the specified date
    const healthMetric = await prisma.healthMetric.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date,
        },
      },
    });

    console.log(`Health Metrics: Retrieved data for user ${session.user.id} and date ${date.toISOString().split('T')[0]}`, { 
      hasData: !!healthMetric,
      validMetricsCount: countValidMetrics(healthMetric)
    });

    // No data available
    if (!healthMetric) {
      console.log('Health Metrics: No data found for this date');
      return NextResponse.json(
        { 
          message: 'No health data found for the specified date',
          healthMetric: null
        },
        { status: 404 }
      );
    }
    
    // Data exists but has no valid metrics
    const validMetrics = countValidMetrics(healthMetric);
    if (validMetrics === 0) {
      console.log('Health Metrics: Data exists but no valid metrics');
      return NextResponse.json(
        { 
          message: 'No valid health metrics found for the specified date',
          healthMetric
        },
        { status: 200 }
      );
    }
    
    console.log(`Health Metrics: Returning real data with ${validMetrics} valid metrics`);
    
    return NextResponse.json(
      { 
        healthMetric
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching health metrics:', error);
    return NextResponse.json(
      { message: 'Failed to fetch health metrics' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 