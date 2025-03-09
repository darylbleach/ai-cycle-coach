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

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('Garmin Upload: Starting workflow');
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
      console.log('Garmin Upload: Missing workout data or name');
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
      console.log('Garmin Upload: No Garmin account connected for user', session.user.id);
      return NextResponse.json(
        { message: 'No Garmin account connected' },
        { status: 400 }
      );
    }
    
    console.log(`Garmin Upload: Found Garmin account for user ${session.user.id}: ${garminAccount.providerAccountId}`);

    // Create a temporary file with the workout data
    const tempDir = path.join(process.cwd(), 'tmp');
    
    // Make sure the temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `workout_${Date.now()}.json`);
    fs.writeFileSync(tempFilePath, JSON.stringify(workoutData));
    console.log(`Garmin Upload: Created temporary file at ${tempFilePath}`);
    
    try {
      // Get the correct paths from environment or use defaults with full project path
      const projectRoot = process.cwd();
      const pythonPath = process.env.PYTHON_PATH || path.join(projectRoot, 'garmin-env', 'bin', 'python');
      const garminTokensPath = process.env.GARMIN_TOKEN_DIR || path.join(projectRoot, 'garmin-tokens');
      const scriptPath = path.join(projectRoot, 'scripts', 'garmin_upload_workout.py');
      
      // Build the command with explicit paths
      const command = `${pythonPath} ${scriptPath} "${garminAccount.providerAccountId}" "${garminTokensPath}" "${tempFilePath}"`;
      
      console.log('Garmin Upload: Executing command:', command);
      
      const { stdout, stderr } = await execPromise(command);
      
      console.log('Garmin Upload: Python script output:', stdout);
      if (stderr) {
        console.error('Garmin Upload: Python script errors:', stderr);
      }
      
      // Parse the output
      let result;
      try {
        result = JSON.parse(stdout);
      } catch (e) {
        console.error('Garmin Upload: Error parsing Python script output:', e);
        console.error('Garmin Upload: Raw output:', stdout);
        
        return NextResponse.json(
          { message: 'Invalid response from Garmin upload script' },
          { status: 500 }
        );
      }
      
      if (result.status === 'success') {
        console.log(`Garmin Upload: Successfully uploaded workout with ID ${result.workoutId}`);
        return NextResponse.json({
          message: 'Workout uploaded successfully to Garmin',
          workoutId: result.workoutId
        });
      } else {
        console.error(`Garmin Upload: Failed to upload workout: ${result.error}`);
        return NextResponse.json(
          { message: 'Failed to upload workout to Garmin', error: result.error },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('Garmin Upload: Exception during workout upload:', error);
      return NextResponse.json(
        { message: `Error uploading workout: ${(error as Error).message}` },
        { status: 500 }
      );
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log('Garmin Upload: Cleaned up temporary file');
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