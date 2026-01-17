import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { hashPassword } from '../../../lib/auth/password';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });
  const sess: any = session;
  if (!sess.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = sess.user;
  if (!user.permissions?.manageUsers) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  const { userID, newPassword } = req.body;
  if (!userID || !newPassword) {
    return res.status(400).json({ message: 'userID and newPassword are required' });
  }
  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { userID }, data: { password: hashed } });
  return res.status(200).json({ message: 'Password reset successful' });
} 