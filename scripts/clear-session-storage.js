/**
 * Clear NextAuth Session Storage Script
 * 
 * This script can be run in the browser console to clear all NextAuth-related
 * storage and cookies. This is useful when you change NEXTAUTH_SECRET or
 * encounter JWEDecryptionFailed errors.
 * 
 * To use:
 * 1. Open browser DevTools (F12 or right-click and select "Inspect")
 * 2. Go to the Console tab
 * 3. Copy and paste this entire script
 * 4. Press Enter to execute
 * 5. Refresh the page
 */

// Clear localStorage items related to NextAuth
Object.keys(localStorage)
  .filter(key => key.startsWith('next-auth'))
  .forEach(key => {
    console.log(`Clearing localStorage item: ${key}`);
    localStorage.removeItem(key);
  });

// Clear sessionStorage items related to NextAuth
Object.keys(sessionStorage)
  .filter(key => key.startsWith('next-auth'))
  .forEach(key => {
    console.log(`Clearing sessionStorage item: ${key}`);
    sessionStorage.removeItem(key);
  });

// Function to clear all cookies
function clearAllCookies() {
  const cookies = document.cookie.split(';');
  
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
    
    // Clear the cookie by setting its expiration date to the past
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    console.log(`Cleared cookie: ${name}`);
  }
}

// Clear all cookies
clearAllCookies();

// Provide feedback
console.log('All NextAuth sessions and cookies have been cleared.');
console.log('Please refresh the page and log in again.'); 