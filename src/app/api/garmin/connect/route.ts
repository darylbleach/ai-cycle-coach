import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// Convert exec to Promise-based
const execAsync = promisify(exec);

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('Garmin Connect: Starting authentication process');
    
    // Get the user session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      console.error('Garmin Connect: No valid session found');
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    console.log(`Garmin Connect: User authenticated with ID ${userId}`);
    
    // Get the credentials from the request body
    const { username, password } = await req.json();
    
    if (!username || !password) {
      console.error('Garmin Connect: Missing username or password');
      return NextResponse.json(
        { message: 'Username and password are required' },
        { status: 400 }
      );
    }
    
    // Call the Python script for authentication
    try {
      console.log(`Garmin Connect: Authenticating user ${username} with Garmin Connect`);
      
      // Make sure the token directory exists
      const tokenDir = process.env.GARMIN_TOKEN_DIR || './garmin-tokens';
      await fs.mkdir(tokenDir, { recursive: true });
      
      // Store the password in a session file for use by the sync script
      try {
        const sessionDir = `${tokenDir}/sessions`;
        await fs.mkdir(sessionDir, { recursive: true });
        
        // Only save password if we have a userId
        if (userId) {
          const sessionFile = `${sessionDir}/${userId}.json`;
          const sessionData = {
            username,
            password,
            timestamp: new Date().toISOString()
          };
          await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
          console.log(`Garmin Connect: Cached session data for future sync`);
        }
      } catch (e) {
        console.error(`Garmin Connect: Error caching session: ${e}`);
        // Continue even if we can't cache the password
      }
      
      // Create token directory if it doesn't exist
      const tokenPath = path.join(tokenDir, username);
      await fs.mkdir(path.dirname(tokenPath), { recursive: true });
      
      // Use environment variable for Python path or fallback
      const pythonPath = process.env.PYTHON_PATH || `${process.cwd()}/garmin-env/bin/python`;
      const command = `${pythonPath} scripts/garmin_direct_auth.py "${username}" "${password}"`;
      
      // Execute the Python script
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.error(`Garmin Connect: Script stderr: ${stderr}`);
      }
      
      let result;
      try {
        result = JSON.parse(stdout);
      } catch (e) {
        console.error(`Garmin Connect: Error parsing script output: ${e}`);
        console.error(`Garmin Connect: Raw output: ${stdout}`);
        return NextResponse.json(
          { message: 'Error parsing authentication response from Garmin Connect' },
          { status: 500 }
        );
      }
      
      console.log(`Garmin Connect: Authentication result: ${result.status}`);
      
      if (result.status !== 'success') {
        console.error(`Garmin Connect: Authentication failed: ${result.message}`);
        
        // Check for specific error types
        if (result.error_type === 'mfa_required') {
          return NextResponse.json(
            { 
              message: 'Multi-factor authentication is enabled on your Garmin account. Please disable it temporarily to connect.',
              error_type: 'mfa_required'
            },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
          { message: result.message },
          { status: 400 }
        );
      }
      
      // Authentication successful, store the connection in the database
      console.log(`Garmin Connect: Authentication successful for ${username}`);
      
      // Check if this Garmin account is already connected to another user
      const existingAccount = await prisma.account.findFirst({
        where: {
          provider: 'garmin',
          providerAccountId: username,
        },
      });
      
      if (existingAccount && existingAccount.userId !== userId) {
        console.error(`Garmin Connect: This Garmin account is already connected to another user`);
        return NextResponse.json(
          { message: 'This Garmin account is already connected to another user' },
          { status: 400 }
        );
      }
      
      // Check if the user already has a Garmin account connected
      const userGarminAccount = await prisma.account.findFirst({
        where: {
          userId,
          provider: 'garmin',
        },
      });
      
      if (userGarminAccount) {
        // Update existing account
        console.log(`Garmin Connect: Updating existing Garmin account for user ${userId}`);
        await prisma.account.update({
          where: { id: userGarminAccount.id },
          data: {
            providerAccountId: username,
          },
        });
      } else {
        // Create new account
        console.log(`Garmin Connect: Creating new Garmin account for user ${userId}`);
        await prisma.account.create({
          data: {
            userId,
            type: 'oauth',
            provider: 'garmin',
            providerAccountId: username,
          },
        });
      }
      
      console.log(`Garmin Connect: Successfully connected Garmin account for user ${userId}`);
      
      // Return success
      return NextResponse.json({
        message: 'Successfully connected to Garmin Connect',
        userData: result.userData || { name: 'Garmin User' }
      });
      
    } catch (error) {
      console.error(`Garmin Connect: Error during authentication: ${error}`);
      return NextResponse.json(
        { message: `Failed to authenticate with Garmin Connect: ${(error as Error).message}` },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error(`Garmin Connect: Uncaught error: ${error}`);
    return NextResponse.json(
      { message: 'An error occurred during Garmin Connect authentication' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 