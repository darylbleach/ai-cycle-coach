import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('Garmin Disconnect: Starting disconnection process');
    
    // Get the user session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.id) {
      console.error('Garmin Disconnect: Unauthorized request');
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    console.log(`Garmin Disconnect: User authenticated with ID ${userId}`);
    
    // Find the user's Garmin account
    const garminAccount = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: 'garmin',
      },
    });

    if (!garminAccount) {
      console.error('Garmin Disconnect: No connected Garmin account found');
      return NextResponse.json(
        { message: 'No connected Garmin account found' },
        { status: 400 }
      );
    }

    // Get the Garmin username from the account
    const garminUsername = garminAccount.providerAccountId;
    console.log(`Garmin Disconnect: Found Garmin account: ${garminUsername}`);

    // Delete the Garmin account from the database
    await prisma.account.delete({
      where: {
        id: garminAccount.id,
      },
    });
    console.log(`Garmin Disconnect: Deleted Garmin account from database`);

    // Try to delete any token files for this user
    try {
      const tokenDir = process.env.GARMIN_TOKEN_DIR || './garmin-tokens';
      const tokenPath = path.join(tokenDir, `${garminUsername}.json`);
      
      await fs.unlink(tokenPath).catch(() => {
        // Ignore errors if the file doesn't exist
        console.log(`Garmin Disconnect: No token file found for ${garminUsername}`);
      });
      
      console.log(`Garmin Disconnect: Deleted token file for ${garminUsername}`);
    } catch (error) {
      console.error(`Garmin Disconnect: Error deleting token files: ${error}`);
      // Continue anyway as we've already deleted the account from the database
    }

    return NextResponse.json({
      message: 'Garmin account disconnected successfully',
    });
  } catch (error) {
    console.error(`Garmin Disconnect: Error: ${error}`);
    return NextResponse.json(
      { message: 'Failed to disconnect Garmin account' },
      { status: 500 }
    );
  }
} 