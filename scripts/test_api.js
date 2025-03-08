// Test script to verify the health metrics API endpoint
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing health metrics API endpoint simulation...');
    
    // 1. Get a user ID from the database to use for our test
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No users found in the database. Please create a user first.');
      return;
    }
    
    console.log(`Using user: ${user.id} (${user.name || user.email})`);
    
    // 2. Get health metrics for this user directly from the database
    const healthMetric = await prisma.healthMetric.findFirst({
      where: { userId: user.id },
      orderBy: { date: 'desc' }
    });
    
    if (!healthMetric) {
      console.log('No health metrics found for this user.');
      return;
    }
    
    console.log(`\nFound health metric in database for date: ${healthMetric.date.toISOString().split('T')[0]}`);
    console.log(`VO2max value in database: ${healthMetric.vo2max !== null ? healthMetric.vo2max : 'NULL'}`);
    
    // 3. Simulate what our API would do with this data
    console.log('\nSimulating API response:');
    
    // Check if it's simulated data based on ID pattern
    const isSimulated = healthMetric.id.startsWith('sim_');
    
    // NO LONGER simulating VO2max if it's missing - we're only using real data now
    console.log(`Using real data only approach - VO2max will remain ${healthMetric.vo2max !== null ? healthMetric.vo2max : 'NULL'}`);
    
    // Count valid metrics
    function countValidMetrics(data) {
      if (!data) return 0;
      
      let count = 0;
      if (data.trainingReadiness !== null) count++;
      if (data.sleepHours !== null) count++;
      if (data.bodyBattery !== null) count++;
      if (data.hrv !== null) count++;
      if (data.avgStressLevel !== null) count++;
      if (data.restingHeartRate !== null) count++;
      if (data.vo2max !== null) count++;
      
      return count;
    }
    
    const validMetricsCount = countValidMetrics(healthMetric);
    
    console.log(`\nFinal API response would have:`);
    console.log(`- VO2max: ${healthMetric.vo2max !== null ? healthMetric.vo2max : 'NULL'}`);
    console.log(`- Valid metrics count: ${validMetricsCount}/7`);
    console.log(`- Is simulated: ${isSimulated}`);
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error('Unhandled error in main:', e);
  process.exit(1);
}); 