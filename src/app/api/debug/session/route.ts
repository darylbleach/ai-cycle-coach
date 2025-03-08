import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('Debug: Getting server session information');
    const session = await getServerSession(authOptions);
    
    let dbUser = null;
    if (session?.user?.id) {
      try {
        dbUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { 
            id: true, 
            email: true, 
            ftp: true 
          }
        });
      } catch (dbError) {
        console.error('Debug: Error fetching user from DB:', dbError);
      }
    }
    
    console.log('Debug: Session data:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasUserId: !!session?.user?.id,
      userId: session?.user?.id,
      email: session?.user?.email,
      ftp: session?.user?.ftp,
      dbUserFtp: dbUser?.ftp,
      sessionFtpMatchesDb: session?.user?.ftp === dbUser?.ftp,
      // Don't log sensitive information
      sessionKeys: session ? Object.keys(session) : [],
      userKeys: session?.user ? Object.keys(session.user) : []
    });
    
    // Return minimal information to avoid exposing sensitive data
    return NextResponse.json({
      isAuthenticated: !!session,
      hasUserId: !!session?.user?.id,
      userEmailDomain: session?.user?.email ? session.user.email.split('@')[1] : null,
      sessionProperties: session ? Object.keys(session) : [],
      userProperties: session?.user ? Object.keys(session.user) : [],
      ftp: {
        sessionFtp: session?.user?.ftp,
        dbFtp: dbUser?.ftp,
        match: session?.user?.ftp === dbUser?.ftp
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Debug session error:', error);
    return NextResponse.json(
      { message: 'Error retrieving session data', error: String(error) },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 