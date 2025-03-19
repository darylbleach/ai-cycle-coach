import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcrypt';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || (isProduction ? 'https://yourdomain.com' : 'http://localhost:3000');

// Ensure we have a valid NEXTAUTH_SECRET
if (!process.env.NEXTAUTH_SECRET) {
  console.warn('Warning: NEXTAUTH_SECRET is not set. Generating a random secret for this session only.');
  process.env.NEXTAUTH_SECRET = crypto.randomBytes(32).toString('hex');
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        // Security check: make sure we're not getting credentials from query params
        if (req?.query?.email || req?.query?.password) {
          console.error('Security warning: Credentials detected in URL parameters');
          throw new Error('For security reasons, credentials cannot be passed via URL parameters');
        }

        if (!credentials?.email || !credentials?.password) {
          console.error('Missing credentials: Email or password missing');
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user || !user.password) {
            console.warn(`Login failed: User not found or no password set for ${credentials.email}`);
            return null;
          }

          const isPasswordValid = await compare(credentials.password, user.password);

          if (!isPasswordValid) {
            console.warn(`Login failed: Invalid password for ${credentials.email}`);
            return null;
          }

          console.log(`Login successful: ${credentials.email}`);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            ftp: user.ftp || undefined,
          };
        } catch (error) {
          console.error(`Authentication error: ${error}`);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/login',
    newUser: '/auth/register',
    error: '/auth/error', // Add error page
  },
  cookies: {
    sessionToken: {
      name: isProduction ? `__Secure-next-auth.session-token` : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      }
    },
    callbackUrl: {
      name: isProduction ? `__Secure-next-auth.callback-url` : `next-auth.callback-url`,
      options: {
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      }
    },
    csrfToken: {
      name: isProduction ? `__Host-next-auth.csrf-token` : `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      }
    }
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.ftp = user.ftp;
      }
      
      // Handle updates from the client
      if (trigger === "update" && session?.ftp) {
        console.log("JWT update triggered with FTP:", session.ftp);
        token.ftp = session.ftp;
      }
      
      return token;
    },
    async session({ session, token, trigger, newSession }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.ftp = token.ftp as number | undefined;
      }
      
      // Handle updates for database strategy
      if (trigger === "update" && newSession?.ftp) {
        console.log("Session update triggered with FTP:", newSession.ftp);
        session.user.ftp = newSession.ftp;
      }
      
      return session;
    },
  },
  // Force usage of POST for authentication requests
  useSecureCookies: isProduction,
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.DEBUG === 'true',
  logger: {
    error(code: string, metadata: any) {
      console.error(`Auth error (${code})`, metadata);
    },
    warn(code: string) {
      console.warn(`Auth warning (${code})`);
    },
    debug(code: string, metadata: any) {
      if (process.env.DEBUG === 'true') {
        console.debug(`Auth debug (${code})`, metadata);
      }
    },
  },
}; 