import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  process.env.NEXTAUTH_URL = `${proto}://${host}`;

  return await NextAuth(req, res, authOptions);
}