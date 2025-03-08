import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'

const prisma = new PrismaClient()

// Create a schema for validation
const ftpSchema = z.object({
  ftp: z.number().min(50).max(500),
})

export async function POST(req: Request) {
  try {
    console.log('Update FTP: Starting process');
    const session = await getServerSession(authOptions)

    if (!session) {
      console.error('Update FTP: No session found');
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    if (!session.user?.id) {
      console.error('Update FTP: Session does not contain user ID');
      console.log('Update FTP: Session data:', {
        hasUser: !!session.user,
        sessionKeys: Object.keys(session),
        userKeys: session.user ? Object.keys(session.user) : []
      });
      return NextResponse.json(
        { message: 'Unauthorized - No user ID in session' },
        { status: 401 }
      )
    }

    console.log(`Update FTP: User authenticated with ID ${session.user.id}`);
    
    let body;
    try {
      body = await req.json();
      console.log('Update FTP: Received request body:', body);
    } catch (error) {
      console.error('Update FTP: Failed to parse request body:', error);
      return NextResponse.json(
        { message: 'Invalid request body' },
        { status: 400 }
      )
    }
    
    // Validate the input
    const result = ftpSchema.safeParse(body)
    if (!result.success) {
      console.error('Update FTP: Validation failed:', result.error.flatten());
      return NextResponse.json(
        { message: 'Invalid input', errors: result.error.flatten() },
        { status: 400 }
      )
    }

    const { ftp } = result.data
    console.log(`Update FTP: Valid FTP value received: ${ftp}`);

    // Update the user's FTP
    try {
      const user = await prisma.user.update({
        where: { id: session.user.id },
        data: { ftp },
      })
      console.log(`Update FTP: Successfully updated FTP to ${ftp} for user ${user.id}`);

      // Return the updated user without sensitive information
      return NextResponse.json(
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            ftp: user.ftp,
          },
        },
        { status: 200 }
      )
    } catch (dbError) {
      console.error('Update FTP: Database update error:', dbError);
      return NextResponse.json(
        { message: 'Failed to update FTP in database' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Update FTP error:', error);
    return NextResponse.json(
      { message: 'An error occurred while updating FTP: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
} 