import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { verifyPassword } from '../../../lib/auth/password';
import { signJwt } from '../../../lib/auth/jwt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Fetch permissions
  const permissions = await prisma.permission.findFirst({ where: { userID: user.userID } });

  const token = signJwt({
    userID: user.userID,
    username: user.username,
    role: user.role,
    permissions,
  });

  return res.status(200).json({ token, user: { userID: user.userID, username: user.username, role: user.role, permissions } });
} 