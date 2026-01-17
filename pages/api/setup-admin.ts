import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma/prisma';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // DB connection check endpoint
  if (req.method === 'GET' && req.query.dbcheck) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({ connected: true });
    } catch (e: any) {
      return res.status(200).json({ connected: false, error: e.message || 'Failed to connect' });
    }
  }

  // Check if any users exist
  const userCount = await prisma.user.count();

  if (req.method === 'GET' && req.query.check) {
    return res.status(200).json({ exists: userCount > 0 });
  }

  if (req.method === 'POST') {
    if (userCount > 0) {
      return res.status(403).json({ message: 'Setup already completed.' });
    }
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
      data: {
        username,
        email,
        password: hashed,
        role: 'admin',
        permissions: {
          create: {
            viewOnly: true,
            createProcedureLog: true,
            editProcedureLog: true,
            editSettings: true,
            manageUsers: true,
          },
        },
      },
      include: { permissions: true },
    });
    return res.status(201).json({ message: 'Admin created', user: { ...admin, password: undefined } });
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 