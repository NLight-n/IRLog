import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { AuthOptions, Session, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';

const prisma = new PrismaClient();

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        const user = await prisma.user.findFirst({
          where: { username: { equals: credentials.username, mode: 'insensitive' } },
          include: { permissions: true },
        });
        console.log('Authorize: found user:', user);
        if (!user) return null;
        console.log('Authorize: comparing password', credentials.password, 'with hash', user.password);
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        // Attach permissions to user object for session
        return {
          id: String(user.userID),
          username: user.username,
          email: user.email,
          name: user.username,
          role: user.role,
          permissions: user.permissions?.[0] || {},
        } as any;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      console.log('DEBUG: jwt callback - token IN:', JSON.stringify(token), 'user:', JSON.stringify(user));
      if (user) {
        token.id = (user as any).id;
        token.username = (user as any).username;
        token.email = (user as any).email;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
      }
      // Always fetch latest permissions from DB
      let dbUser = null;
      if (token.id) {
        dbUser = await prisma.user.findUnique({
          where: { userID: Number(token.id) },
          include: { permissions: true },
        });
      } else if (token.email) {
        dbUser = await prisma.user.findUnique({
          where: { email: String(token.email) },
          include: { permissions: true },
        });
      } else if (token.username) {
        dbUser = await prisma.user.findUnique({
          where: { username: String(token.username) },
          include: { permissions: true },
        });
      }
      if (dbUser) {
        token.id = String(dbUser.userID);
        token.username = dbUser.username;
        token.email = dbUser.email;
        token.role = dbUser.role;
        token.permissions = (dbUser.permissions && dbUser.permissions[0]) ? dbUser.permissions[0] : {};
      }
      console.log('DEBUG: jwt callback - token OUT:', JSON.stringify(token));
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      console.log('DEBUG: session callback - session IN:', JSON.stringify(session), 'token:', JSON.stringify(token));
      if (session.user && token) {
        const newSession = {
          ...session,
          user: {
            ...session.user,
            id: token.id,
            userID: token.id, // for compatibility
            sub: token.id,    // for compatibility
            username: token.username,
            role: token.role,
            permissions: token.permissions,
          }
        };
        console.log('DEBUG: session callback - session OUT:', JSON.stringify(newSession));
        return newSession;
      }
      console.log('DEBUG: session callback - session OUT (unchanged):', JSON.stringify(session));
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
};