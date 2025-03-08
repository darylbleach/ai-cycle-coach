import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

// Tell Next.js this is a dynamic route that should not be statically generated
export const dynamic = 'force-dynamic';

// Export the handler functions for API routes
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 