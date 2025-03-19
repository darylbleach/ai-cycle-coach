#!/usr/bin/env node
/**
 * Create Test User Script
 * -----------------------
 * This script creates a test user for local development.
 * 
 * Usage: node scripts/create-test-user.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Create a new Prisma client
const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Check if test user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });
    
    if (existingUser) {
      console.log('Test user already exists with ID:', existingUser.id);
      return existingUser;
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create the user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        password: hashedPassword,
        ftp: 250,
      },
    });
    
    console.log('Test user created successfully:');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.name}`);
    console.log(`FTP: ${user.ftp}`);
    console.log('Password: password123');
    
    return user;
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
createTestUser()
  .then(() => console.log('Done!'))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 