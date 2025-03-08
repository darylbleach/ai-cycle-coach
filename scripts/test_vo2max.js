// Test script to verify VO2max implementation
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing VO2max implementation...');
    
    // 1. Check if the VO2max field exists in the database schema
    console.log('\n1. Checking database schema for VO2max field:');
    try {
      const healthMetricFields = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'HealthMetric'
      `;
      
      console.log('HealthMetric table fields:');
      console.log(healthMetricFields);
      
      const hasVO2maxField = healthMetricFields.some(
        field => field.column_name.toLowerCase() === 'vo2max'
      );
      
      console.log(`VO2max field exists in schema: ${hasVO2maxField ? 'YES' : 'NO'}`);
    } catch (error) {
      console.error('Error checking schema:', error);
    }
    
    // 2. Check recent health metrics records
    console.log('\n2. Checking recent health metrics records:');
    try {
      const recentMetrics = await prisma.healthMetric.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      
      console.log(`Found ${recentMetrics.length} recent health metrics records`);
      console.log(JSON.stringify(recentMetrics, null, 2));
    } catch (error) {
      console.error('Error checking recent metrics:', error);
    }
    
    // 3. Test our simulated VO2max logic
    console.log('\n3. Testing simulated VO2max logic:');
    
    // Generate a consistent simulated VO2max based on user ID and date
    function generateSimulatedVO2max(userId, date) {
      const userIdSeed = parseInt(userId.replace(/\D/g, '').slice(0, 4) || '1234');
      const dateSeed = date.getDate() + (date.getMonth() * 30);
      const combinedSeed = (userIdSeed + dateSeed) % 20; // 0-19 range
      
      // Generate VO2max between 40-60 based on the seed
      return 40 + combinedSeed;
    }
    
    // Test with a few sample user IDs and dates
    const testCases = [
      { userId: 'user_123456', date: new Date('2025-03-01') },
      { userId: 'user_789012', date: new Date('2025-03-02') },
      { userId: 'user_123456', date: new Date('2025-03-15') }
    ];
    
    testCases.forEach(({ userId, date }) => {
      const simulatedVO2max = generateSimulatedVO2max(userId, date);
      console.log(`User ${userId} on ${date.toISOString().split('T')[0]} would get VO2max: ${simulatedVO2max}`);
    });
    
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