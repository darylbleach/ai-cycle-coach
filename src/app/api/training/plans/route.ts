import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { PrismaClient } from '@prisma/client'
import { authOptions } from '@/lib/auth'

const prisma = new PrismaClient()

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
      console.log('Training Plans: No authenticated user session', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!session?.user?.id
      });
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the URL parameters
    const url = new URL(req.url);
    const planId = url.searchParams.get('planId');

    // If planId is provided, fetch a single plan
    if (planId) {
      console.log(`Training Plans: Fetching single plan ${planId} for user ${session.user.id}`);
      
      const trainingPlan = await prisma.trainingPlan.findUnique({
        where: {
          id: planId,
        },
        include: {
          workouts: {
            orderBy: {
              date: 'asc',
            },
          },
        },
      });

      if (!trainingPlan) {
        console.log(`Training Plans: Plan ${planId} not found`);
        return NextResponse.json(
          { message: 'Training plan not found' },
          { status: 404 }
        )
      }

      // Verify the plan belongs to the user
      if (trainingPlan.userId !== session.user.id) {
        console.log(`Training Plans: Plan ${planId} does not belong to user ${session.user.id}`);
        return NextResponse.json(
          { message: 'Unauthorized: You do not have permission to view this plan' },
          { status: 403 }
        )
      }

      console.log(`Training Plans: Successfully fetched plan ${planId} with ${trainingPlan.workouts.length} workouts`);

      return NextResponse.json(
        { trainingPlan },
        { status: 200 }
      )
    }
    
    // If no planId, fetch all plans
    console.log(`Training Plans: Fetching all plans for user ${session.user.id}`);
    
    // Fetch the user's training plans with their workouts
    const trainingPlans = await prisma.trainingPlan.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        workouts: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`Training Plans: Found ${trainingPlans.length} plans`);

    return NextResponse.json(
      { trainingPlans },
      { status: 200 }
    )
  } catch (error) {
    console.error('Fetch training plans error:', error)
    return NextResponse.json(
      { message: 'An error occurred while fetching training plans' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
      console.log('Delete Training Plan: No authenticated user session', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!session?.user?.id
      });
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the plan ID from the URL
    const url = new URL(req.url);
    const planId = url.searchParams.get('planId');

    if (!planId) {
      console.log('Delete Training Plan: No plan ID provided');
      return NextResponse.json(
        { message: 'No plan ID provided' },
        { status: 400 }
      )
    }

    console.log(`Delete Training Plan: Attempting to delete plan ${planId} for user ${session.user.id}`);
    
    // First verify the plan belongs to the user
    const plan = await prisma.trainingPlan.findUnique({
      where: {
        id: planId,
      },
    });

    if (!plan) {
      console.log(`Delete Training Plan: Plan ${planId} not found`);
      return NextResponse.json(
        { message: 'Training plan not found' },
        { status: 404 }
      )
    }

    if (plan.userId !== session.user.id) {
      console.log(`Delete Training Plan: Plan ${planId} does not belong to user ${session.user.id}`);
      return NextResponse.json(
        { message: 'Unauthorized: You do not have permission to delete this plan' },
        { status: 403 }
      )
    }

    // Delete all workouts associated with the plan
    await prisma.workout.deleteMany({
      where: {
        trainingPlanId: planId,
      },
    });

    // Delete the plan
    await prisma.trainingPlan.delete({
      where: {
        id: planId,
      },
    });

    console.log(`Delete Training Plan: Successfully deleted plan ${planId}`);

    return NextResponse.json(
      { message: 'Training plan deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Delete training plan error:', error)
    return NextResponse.json(
      { message: 'An error occurred while deleting the training plan' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
} 