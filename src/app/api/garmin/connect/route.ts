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
      
      // Store the username in a session file for use by the sync script
      try {
        const sessionDir = `${tokenDir}/sessions`;
        await fs.mkdir(sessionDir, { recursive: true });
        
        // Only save username if we have a userId (don't store passwords)
        if (userId) {
          const sessionFile = `${sessionDir}/${userId}.json`;
          const sessionData = {
            username,
            timestamp: new Date().toISOString()
          };
          await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
          console.log(`Garmin Connect: Cached session data for future sync`);
        }
      } catch (e) {
        console.error(`Garmin Connect: Error caching session: ${e}`);
        // Continue even if we can't cache the session info
      }
      
      // Use environment variable for Python path or fallback
      const pythonPath = process.env.PYTHON_PATH || `${process.cwd()}/garmin-env/bin/python`;
      
      // Try the advanced auth script first (more reliable)
      console.log('Garmin Connect: Using advanced authentication script');
      const advancedCommand = `${pythonPath} scripts/garmin_advanced_auth.py "${username}" "${password}" --clear-tokens`;
      
      // Execute the Python script
      console.log(`Garmin Connect: Executing auth script`);
      const { stdout, stderr } = await execAsync(advancedCommand);
      
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
      
      if (result.status !== 'success' && result.status !== 'warning') {
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
        
        // Fall back to direct_auth script if advanced auth fails
        console.log('Garmin Connect: Trying fallback authentication method');
        const fallbackCommand = `${pythonPath} scripts/garmin_direct_auth.py "${username}" "${password}"`;
        
        try {
          const { stdout: fallbackStdout, stderr: fallbackStderr } = await execAsync(fallbackCommand);
          
          if (fallbackStderr) {
            console.error(`Garmin Connect: Fallback stderr: ${fallbackStderr}`);
          }
          
          let fallbackResult;
          try {
            fallbackResult = JSON.parse(fallbackStdout);
          } catch (e) {
            console.error(`Garmin Connect: Error parsing fallback output: ${e}`);
            return NextResponse.json(
              { message: result.message || 'Authentication failed with both methods' },
              { status: 400 }
            );
          }
          
          if (fallbackResult.status !== 'success') {
            return NextResponse.json(
              { message: fallbackResult.message || 'Authentication failed with both methods' },
              { status: 400 }
            );
          }
          
          console.log('Garmin Connect: Fallback authentication successful');
          result = fallbackResult;
        } catch (fallbackError) {
          console.error(`Garmin Connect: Fallback auth failed: ${fallbackError}`);
          return NextResponse.json(
            { message: result.message || 'Authentication failed with all methods' },
            { status: 400 }
          );
        }
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
      
      // Try to sync immediately after connecting to get initial data
      try {
        const syncCommand = `${pythonPath} scripts/garmin_direct_sync.py "${username}" "${tokenDir}"`;
        console.log(`Garmin Connect: Running initial sync`);
        
        // Run in background, don't wait for it
        exec(syncCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`Garmin Connect: Initial sync error: ${error}`);
          } else {
            console.log(`Garmin Connect: Initial sync completed`);
          }
        });
      } catch (syncError) {
        console.error(`Garmin Connect: Error starting initial sync: ${syncError}`);
        // Continue even if initial sync fails
      }
      
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