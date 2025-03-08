import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { PrismaClient } from '@prisma/client'
import { authOptions } from '@/lib/auth'

const prisma = new PrismaClient()

export async function DELETE(req: Request) {
  try {
    console.log('Delete Account: Starting process');
    const session = await getServerSession(authOptions)

    if (!session) {
      console.error('Delete Account: No session found');
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    if (!session.user?.id) {
      console.error('Delete Account: Session does not contain user ID');
      console.log('Delete Account: Session data:', {
        hasUser: !!session.user,
        sessionKeys: Object.keys(session),
        userKeys: session.user ? Object.keys(session.user) : []
      });
      return NextResponse.json(
        { message: 'Unauthorized - No user ID in session' },
        { status: 401 }
      )
    }

    const userId = session.user.id;
    console.log(`Delete Account: User authenticated with ID ${userId}`);
    
    // Start a transaction to ensure all related data is deleted
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete health metrics
      const deletedHealthMetrics = await tx.healthMetric.deleteMany({
        where: { userId }
      });
      console.log(`Delete Account: Deleted ${deletedHealthMetrics.count} health metrics`);
      
      // 2. Delete workouts through training plans
      // First get all training plan IDs
      const trainingPlans = await tx.trainingPlan.findMany({
        where: { userId },
        select: { id: true }
      });
      
      const trainingPlanIds = trainingPlans.map(plan => plan.id);
      
      // Delete workouts associated with user's training plans
      const deletedWorkouts = await tx.workout.deleteMany({
        where: { 
          trainingPlanId: { in: trainingPlanIds }
        }
      });
      console.log(`Delete Account: Deleted ${deletedWorkouts.count} workouts`);
      
      // 3. Delete training plans
      const deletedTrainingPlans = await tx.trainingPlan.deleteMany({
        where: { userId }
      });
      console.log(`Delete Account: Deleted ${deletedTrainingPlans.count} training plans`);
      
      // 4. Delete notifications
      const deletedNotifications = await tx.notification.deleteMany({
        where: { userId }
      });
      console.log(`Delete Account: Deleted ${deletedNotifications.count} notifications`);
      
      // 5. Delete accounts (OAuth connections)
      const deletedAccounts = await tx.account.deleteMany({
        where: { userId }
      });
      console.log(`Delete Account: Deleted ${deletedAccounts.count} connected accounts`);
      
      // 6. Delete sessions
      const deletedSessions = await tx.session.deleteMany({
        where: { userId }
      });
      console.log(`Delete Account: Deleted ${deletedSessions.count} sessions`);
      
      // 7. Finally, delete the user
      const deletedUser = await tx.user.delete({
        where: { id: userId }
      });
      console.log(`Delete Account: Deleted user ${deletedUser.id}`);
      
      return {
        user: deletedUser,
        metrics: deletedHealthMetrics.count,
        workouts: deletedWorkouts.count,
        trainingPlans: deletedTrainingPlans.count,
        notifications: deletedNotifications.count,
        accounts: deletedAccounts.count,
        sessions: deletedSessions.count
      };
    });
    
    console.log('Delete Account: Successfully deleted all user data', result);
    
    return NextResponse.json(
      { 
        message: 'Account and all associated data deleted successfully',
        details: {
          userId: result.user.id,
          deletedData: {
            healthMetrics: result.metrics,
            workouts: result.workouts,
            trainingPlans: result.trainingPlans,
            notifications: result.notifications,
            connectedAccounts: result.accounts,
            sessions: result.sessions
          }
        }
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Delete Account error:', error);
    return NextResponse.json(
      { message: 'An error occurred while deleting account: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
} 