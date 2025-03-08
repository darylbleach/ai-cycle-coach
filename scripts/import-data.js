// Script to import data from JSON files to the Supabase database
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const importDir = path.join(process.cwd(), 'data-export');

// Make sure the import directory exists
if (!fs.existsSync(importDir)) {
  console.error(`Import directory not found: ${importDir}`);
  process.exit(1);
}

async function importData() {
  try {
    console.log('Starting database import...');
    
    // Import Users
    if (fs.existsSync(path.join(importDir, 'users.json'))) {
      const users = JSON.parse(fs.readFileSync(path.join(importDir, 'users.json'), 'utf8'));
      console.log(`Importing ${users.length} users...`);
      
      for (const user of users) {
        // We need to handle dates properly
        const userData = {
          ...user,
          emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
        };
        
        await prisma.user.upsert({
          where: { id: user.id },
          update: userData,
          create: userData,
        });
      }
      console.log('Users imported successfully');
    }
    
    // Import Accounts
    if (fs.existsSync(path.join(importDir, 'accounts.json'))) {
      const accounts = JSON.parse(fs.readFileSync(path.join(importDir, 'accounts.json'), 'utf8'));
      console.log(`Importing ${accounts.length} accounts...`);
      
      for (const account of accounts) {
        await prisma.account.upsert({
          where: { 
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId
            } 
          },
          update: account,
          create: account,
        });
      }
      console.log('Accounts imported successfully');
    }
    
    // Import HealthMetrics
    if (fs.existsSync(path.join(importDir, 'health-metrics.json'))) {
      const healthMetrics = JSON.parse(fs.readFileSync(path.join(importDir, 'health-metrics.json'), 'utf8'));
      console.log(`Importing ${healthMetrics.length} health metrics records...`);
      
      for (const metric of healthMetrics) {
        const metricData = {
          ...metric,
          date: new Date(metric.date),
          createdAt: metric.createdAt ? new Date(metric.createdAt) : new Date(),
          updatedAt: metric.updatedAt ? new Date(metric.updatedAt) : new Date(),
        };
        
        await prisma.healthMetrics.upsert({
          where: { id: metric.id },
          update: metricData,
          create: metricData,
        });
      }
      console.log('Health metrics imported successfully');
    }
    
    // Import Workouts
    if (fs.existsSync(path.join(importDir, 'workouts.json'))) {
      const workouts = JSON.parse(fs.readFileSync(path.join(importDir, 'workouts.json'), 'utf8'));
      console.log(`Importing ${workouts.length} workouts...`);
      
      for (const workout of workouts) {
        const workoutData = {
          ...workout,
          date: new Date(workout.date),
          createdAt: workout.createdAt ? new Date(workout.createdAt) : new Date(),
          updatedAt: workout.updatedAt ? new Date(workout.updatedAt) : new Date(),
        };
        
        await prisma.workout.upsert({
          where: { id: workout.id },
          update: workoutData,
          create: workoutData,
        });
      }
      console.log('Workouts imported successfully');
    }
    
    // Add more imports here if you have additional tables...
    
    console.log('Import completed successfully!');
    
  } catch (error) {
    console.error('Error importing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importData(); 