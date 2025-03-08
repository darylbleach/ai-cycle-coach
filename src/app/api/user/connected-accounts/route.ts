import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    console.log('Connected Accounts: Retrieving session');
    const session = await getServerSession(authOptions);
    
    console.log('Connected Accounts: Session data:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasUserId: !!session?.user?.id
    });

    if (!session || !session.user?.id) {
      console.log('Connected Accounts: No session or user ID found');
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get connected accounts for the user
    console.log(`Connected Accounts: Finding accounts for user ${session.user.id}`);
    const accounts = await prisma.account.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        type: true,
      },
    });

    console.log(`Connected Accounts: Found ${accounts.length} accounts`);
    return NextResponse.json(
      { accounts },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching connected accounts:', error);
    return NextResponse.json(
      { message: 'Failed to fetch connected accounts' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 