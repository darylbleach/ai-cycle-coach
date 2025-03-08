// Script to export data from current database to JSON files
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Ensure Prisma client is initialized properly
const prisma = new PrismaClient();
const exportDir = path.join(process.cwd(), 'data-export');

// Create export directory if it doesn't exist
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

async function exportData() {
  try {
    console.log('Starting database export...');
    
    // Export Users
    const users = await prisma.user.findMany();
    fs.writeFileSync(
      path.join(exportDir, 'users.json'),
      JSON.stringify(users, null, 2)
    );
    console.log(`Exported ${users.length} users`);
    
    // Export Accounts (Garmin connections)
    const accounts = await prisma.account.findMany();
    fs.writeFileSync(
      path.join(exportDir, 'accounts.json'),
      JSON.stringify(accounts, null, 2)
    );
    console.log(`Exported ${accounts.length} accounts`);
    
    // Export HealthMetrics
    const healthMetrics = await prisma.healthMetrics.findMany();
    fs.writeFileSync(
      path.join(exportDir, 'health-metrics.json'),
      JSON.stringify(healthMetrics, null, 2)
    );
    console.log(`Exported ${healthMetrics.length} health metrics records`);
    
    // Export Workouts
    const workouts = await prisma.workout.findMany();
    fs.writeFileSync(
      path.join(exportDir, 'workouts.json'),
      JSON.stringify(workouts, null, 2)
    );
    console.log(`Exported ${workouts.length} workouts`);
    
    // Export any other models you have
    // Add more exports here if you have additional tables...
    
    console.log('Export completed successfully!');
    console.log(`All data exported to: ${exportDir}`);
    
  } catch (error) {
    console.error('Error exporting data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportData(); 