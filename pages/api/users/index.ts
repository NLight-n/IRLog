import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { hashPassword } from '../../../lib/auth/password';
import { getToken } from 'next-auth/jwt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const user = token;
  const perms = Array.isArray(user.permissions) ? user.permissions[0] : user.permissions;

  if (req.method === 'GET') {
    // Allow users with viewOnly permission to fetch the user list
    if (!perms?.viewOnly) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const users = await prisma.user.findMany({
      select: {
        userID: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        permissions: true,
      },
    });
    // Always return permissions as a flat object and omit password
    const usersWithFlatPerms = users.map((u: any) => {
      const { password, ...rest } = u;
      return {
        ...rest,
        permissions: Array.isArray(u.permissions) ? (u.permissions[0] || {}) : (u.permissions || {})
      };
    });
    return res.status(200).json(usersWithFlatPerms);
  }

  if (req.method === 'POST') {
    // Only allow users with manageUsers permission to create users
    if (!perms?.manageUsers) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const { username, password, email, role, permissions } = req.body;
    if (!username || !password || !email || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const hashed = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashed,
        email,
        role,
        permissions: {
          create: permissions || {},
        },
      },
      include: { permissions: true },
    });
    return res.status(201).json(newUser);
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 