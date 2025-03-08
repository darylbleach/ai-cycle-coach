// scripts/check-dates.js
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '../node_modules/@prisma/client/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function getRealCurrentDate() {
  try {
    // Try to get the current time from an external API
    const response = await fetch("http://worldtimeapi.org/api/ip");
    if (response.ok) {
      const data = await response.json();
      const realDate = new Date(data.datetime);
      console.log(`Real current date from API: ${realDate.toISOString().split('T')[0]}`);
      return realDate;
    } else {
      console.log(`Failed to get real date from API, status code: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error getting real date from API: ${error.message}`);
  }
  
  // Fall back to system date if API fails
  console.log('Falling back to system date');
  return new Date();
}

function isDateInFuture(date, referenceDate) {
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  
  const reference = new Date(referenceDate);
  reference.setHours(0, 0, 0, 0);
  
  return compareDate > reference;
}

async function main() {
  try {
    console.log('Checking health metrics dates in the database...');
    
    // Get the real current date to compare against
    const realCurrentDate = await getRealCurrentDate();
    const systemDate = new Date();
    
    console.log(`System date: ${systemDate.toISOString().split('T')[0]}`);
    console.log(`Real current date: ${realCurrentDate.toISOString().split('T')[0]}`);
    
    const metrics = await prisma.healthMetric.findMany({
      orderBy: {
        date: 'desc'
      }
    });
    
    console.log(`Found ${metrics.length} health metrics records`);
    
    if (metrics.length > 0) {
      console.log('\nHealth Metrics Dates:');
      metrics.forEach(m => {
        const dateStr = m.date.toISOString().split('T')[0];
        const isFuture = isDateInFuture(m.date, realCurrentDate);
        
        console.log(`- ${dateStr} (User: ${m.userId}) ${isFuture ? '⚠️ FUTURE DATE' : ''}`);
      });
      
      // Check for future dates
      const futureDates = metrics.filter(m => isDateInFuture(m.date, realCurrentDate));
      if (futureDates.length > 0) {
        console.log(`\n⚠️ WARNING: Found ${futureDates.length} metrics with future dates!`);
        
        if (process.argv.includes('--fix')) {
          console.log('\nFixing metrics with future dates...');
          
          for (const metric of futureDates) {
            const dateStr = metric.date.toISOString().split('T')[0];
            
            if (process.argv.includes('--convert')) {
              // Convert to real current date instead of deleting
              console.log(`Converting metric from ${dateStr} to ${realCurrentDate.toISOString().split('T')[0]} (User: ${metric.userId})`);
              
              const realCurrentDateOnly = new Date(realCurrentDate);
              realCurrentDateOnly.setHours(0, 0, 0, 0);
              
              // First delete the existing record with future date
              await prisma.healthMetric.delete({
                where: {
                  userId_date: {
                    userId: metric.userId,
                    date: metric.date
                  }
                }
              });
              
              // Then create a new record with the real current date
              const { id, userId, date, ...metricData } = metric;
              await prisma.healthMetric.upsert({
                where: {
                  userId_date: {
                    userId: metric.userId,
                    date: realCurrentDateOnly
                  }
                },
                update: metricData,
                create: {
                  ...metricData,
                  userId: metric.userId,
                  date: realCurrentDateOnly
                }
              });
            } else {
              // Just delete the future date
              console.log(`Deleting metric for date ${dateStr} (User: ${metric.userId})`);
              await prisma.healthMetric.delete({
                where: {
                  userId_date: {
                    userId: metric.userId,
                    date: metric.date
                  }
                }
              });
            }
          }
          
          if (process.argv.includes('--convert')) {
            console.log('Future dates converted to real current date successfully.');
          } else {
            console.log('Future dates deleted successfully.');
          }
        } else {
          console.log('To delete these future dates, run: node scripts/check-dates.js --fix');
          console.log('To convert these dates to the real current date, run: node scripts/check-dates.js --fix --convert');
        }
      } else {
        console.log('\n✅ No future dates found in the database.');
      }
    }
  } catch (error) {
    console.error('Error checking dates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 