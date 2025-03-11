/**
 * Clear Session Storage Script
 * ----------------------------
 * This script clears all NextAuth related cookies and local/session
 * storage and cookies. This is useful when you change NEXTAUTH_SECRET or
 * when you're experiencing authentication issues.
 * 
 * Instructions:
 * 1. Open your browser's developer console (F12 or right-click > Inspect)
 * 2. Go to the Console tab
 * 3. Copy and paste this entire script
 * 4. Press Enter to execute
 * 5. Refresh the page and try logging in again
 */

// Clear all cookies related to NextAuth
function clearNextAuthCookies() {
  const cookies = document.cookie.split(';');
  
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    
    // Check if this is a NextAuth cookie
    if (name.startsWith('next-auth') || name.includes('session-token')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      console.log(`Cleared cookie: ${name}`);
    }
  }
}

// Clear local storage items related to NextAuth
function clearNextAuthLocalStorage() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('next-auth') || key.includes('session'))) {
      localStorage.removeItem(key);
      console.log(`Cleared localStorage item: ${key}`);
    }
  }
}

// Clear session storage items related to NextAuth
function clearNextAuthSessionStorage() {
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.startsWith('next-auth') || key.includes('session'))) {
      sessionStorage.removeItem(key);
      console.log(`Cleared sessionStorage item: ${key}`);
    }
  }
}

// Run all cleanup functions
function clearAllNextAuthData() {
  console.log('Starting NextAuth session cleanup...');
  
  clearNextAuthCookies();
  clearNextAuthLocalStorage();
  clearNextAuthSessionStorage();
  
  console.log('NextAuth session cleanup complete!');
  console.log('Please refresh the page and try logging in again.');
}

// Execute the cleanup
clearAllNextAuthData(); 