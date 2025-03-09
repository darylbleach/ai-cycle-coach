#!/usr/bin/env node
/**
 * Test script for Garmin workout uploads
 * 
 * This script can be used to test the Garmin workout upload functionality
 * directly, without going through the web interface.
 * 
 * Usage:
 *   node scripts/test-garmin-upload.js <garmin-email>
 * 
 * Note: You must have a valid Garmin token file in the garmin-tokens directory.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Sample workout data - a simple cycling workout
const sampleWorkout = {
  workoutName: "Test Interval Workout",
  workoutId: null,
  sportType: { sportTypeId: 2, sportTypeKey: "cycling" },
  workoutSegments: [
    {
      segmentOrder: 1,
      sportType: { sportTypeId: 2, sportTypeKey: "cycling" },
      workoutSteps: [
        {
          type: "warmup",
          stepOrder: 1,
          stepType: { stepTypeId: 1, stepTypeKey: "warmup" },
          description: "Warm up",
          durationType: { typeId: 1, typeKey: "time" },
          durationValue: 600, // 10 minutes in seconds
          targetType: { typeId: 3, typeKey: "power" },
          targetValueLow: 60, // % of FTP
          targetValueHigh: 75
        },
        {
          type: "interval",
          stepOrder: 2,
          stepType: { stepTypeId: 3, stepTypeKey: "interval" },
          description: "Work Interval",
          durationType: { typeId: 1, typeKey: "time" },
          durationValue: 120, // 2 minutes in seconds
          targetType: { typeId: 3, typeKey: "power" },
          targetValueLow: 90, // % of FTP
          targetValueHigh: 100
        },
        {
          type: "recovery",
          stepOrder: 3,
          stepType: { stepTypeId: 4, stepTypeKey: "recovery" },
          description: "Recovery",
          durationType: { typeId: 1, typeKey: "time" },
          durationValue: 60, // 1 minute in seconds
          targetType: { typeId: 3, typeKey: "power" },
          targetValueLow: 50, // % of FTP
          targetValueHigh: 65
        },
        {
          type: "cooldown",
          stepOrder: 4,
          stepType: { stepTypeId: 5, stepTypeKey: "cooldown" },
          description: "Cool down",
          durationType: { typeId: 1, typeKey: "time" },
          durationValue: 300, // 5 minutes in seconds
          targetType: { typeId: 3, typeKey: "power" },
          targetValueLow: 40, // % of FTP
          targetValueHigh: 60
        }
      ]
    }
  ]
};

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/test-garmin-upload.js <garmin-email>');
  process.exit(1);
}

const garminEmail = args[0];

// Set up paths
const rootDir = path.resolve(__dirname, '..');
const garminTokensDir = process.env.GARMIN_TOKEN_DIR || path.join(rootDir, 'garmin-tokens');
const pythonPath = process.env.PYTHON_PATH || path.join(rootDir, 'garmin-env/bin/python');
const scriptPath = path.join(rootDir, 'scripts/garmin_upload_workout.py');

// Create temporary directory for workout JSON
const tempDir = path.join(rootDir, 'tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Create temporary workout JSON file
const tempFilePath = path.join(tempDir, `test_workout_${Date.now()}.json`);
fs.writeFileSync(tempFilePath, JSON.stringify(sampleWorkout, null, 2));

try {
  console.log(`Using Garmin token from: ${garminTokensDir}`);
  console.log(`Using Python interpreter: ${pythonPath}`);
  console.log(`Temporary workout file created at: ${tempFilePath}`);
  
  // Check if token file exists
  const tokenFile = path.join(garminTokensDir, `${garminEmail}.json`);
  if (!fs.existsSync(tokenFile)) {
    console.error(`Error: Token file not found at ${tokenFile}`);
    console.error('Please ensure you have authenticated with Garmin Connect first.');
    process.exit(1);
  }
  
  // Build the command
  const command = `"${pythonPath}" "${scriptPath}" "${garminEmail}" "${garminTokensDir}" "${tempFilePath}"`;
  console.log(`Executing command: ${command}`);
  
  // Execute the upload script
  const output = execSync(command, { encoding: 'utf8' });
  console.log('Script output:');
  console.log(output);
  
  // Parse and display the result
  try {
    const result = JSON.parse(output);
    if (result.status === 'success') {
      console.log(`✓ Success! Workout uploaded with ID: ${result.workoutId}`);
    } else {
      console.error(`✗ Error: ${result.error}`);
    }
  } catch (e) {
    console.error('Could not parse script output JSON:', e);
    console.error('Raw output:', output);
  }
} catch (error) {
  console.error('Error executing script:', error.message);
  if (error.stdout) console.log('stdout:', error.stdout);
  if (error.stderr) console.error('stderr:', error.stderr);
} finally {
  // Clean up temporary file
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
    console.log('Cleaned up temporary file');
  }
} 