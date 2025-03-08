import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);
const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      console.log('Garmin Upload: No authenticated user session');
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { workoutData, workoutName } = body;

    if (!workoutData || !workoutName) {
      return NextResponse.json(
        { message: 'Missing workout data or name' },
        { status: 400 }
      );
    }

    // Find user's Garmin account
    const garminAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'garmin'
      }
    });

    if (!garminAccount) {
      return NextResponse.json(
        { message: 'No Garmin account connected' },
        { status: 400 }
      );
    }

    // Create a temporary file with the workout data
    const tempDir = path.join(process.cwd(), 'tmp');
    
    // Make sure the temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `workout_${Date.now()}.json`);
    fs.writeFileSync(tempFilePath, JSON.stringify(workoutData));
    
    try {
      // Execute Python script to upload workout
      const command = `${process.env.GARMIN_PYTHON_PATH || '/Users/darylbleach/Sites/ai-coach/garmin-env/bin/python'} ${process.cwd()}/scripts/garmin_upload_workout.py "${garminAccount.providerAccountId}" "${process.env.GARMIN_TOKENS_PATH || '/Users/darylbleach/Sites/ai-coach/garmin-tokens'}" "${tempFilePath}"`;
      
      console.log('Garmin Upload: Executing command:', command);
      
      const { stdout, stderr } = await execPromise(command);
      
      console.log('Garmin Upload: Python script output:', stdout);
      if (stderr) {
        console.error('Garmin Upload: Python script errors:', stderr);
      }
      
      // Parse the output
      const result = JSON.parse(stdout);
      
      return NextResponse.json(
        result.status === 'success' 
          ? { message: 'Workout uploaded successfully to Garmin', workoutId: result.workoutId }
          : { message: 'Failed to upload workout to Garmin', error: result.error },
        { status: result.status === 'success' ? 200 : 500 }
      );
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  } catch (error) {
    console.error('Garmin upload workout error:', error);
    return NextResponse.json(
      { message: 'An error occurred while uploading the workout to Garmin' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 