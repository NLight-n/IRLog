import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';
import { hashPassword, verifyPassword } from '../../../lib/auth/password';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || typeof session !== 'object' || !('user' in session) || !session.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const user = (session as any).user;
  // Debug: Log the user object structure
  console.log('User profile API - session.user:', JSON.stringify(user, null, 2));

  // Try to extract userID from session
  let userID: number | undefined;
  if (user.id) {
    userID = parseInt(user.id as string);
  } else if (user.userID) {
    userID = parseInt(user.userID as string);
  } else if (user.sub) {
    userID = parseInt(user.sub as string);
  }

  if (req.method === 'GET') {
    let dbUser = null;
    if (userID && !isNaN(userID)) {
      dbUser = await prisma.user.findUnique({
        where: { userID },
        select: { userID: true, username: true, email: true, role: true, theme: true, accentColor: true, columns: true, updatedAt: true,
          permissions: {
            select: {
              viewOnly: true,
              createProcedureLog: true,
              editProcedureLog: true,
              editSettings: true,
              manageUsers: true,
            }
          }
        },
      });
    } else if (user.email) {
      dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { userID: true, username: true, email: true, role: true, theme: true, accentColor: true, columns: true, updatedAt: true,
          permissions: {
            select: {
              viewOnly: true,
              createProcedureLog: true,
              editProcedureLog: true,
              editSettings: true,
              manageUsers: true,
            }
          }
        },
      });
    } else {
      return res.status(400).json({ message: 'User ID or email not found in session' });
    }
    return res.status(200).json(dbUser);
  }

  if (req.method === 'PATCH') {
    let userWhere: any = {};
    if (userID && !isNaN(userID)) {
      userWhere.userID = userID;
    } else if (user.email) {
      userWhere.email = user.email;
    } else {
      return res.status(400).json({ message: 'User ID or email not found in session' });
    }
    const { username, email, password, theme, accentColor, columns, currentPassword } = req.body;
    const data: any = {};
    if (username) data.username = username;
    if (email) data.email = email;
    if (password) {
      // Require currentPassword for password change
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required' });
      }
      // Fetch user to verify current password
      const dbUser = await prisma.user.findUnique({ where: userWhere });
      if (!dbUser) return res.status(400).json({ message: 'User not found' });
      const valid = await verifyPassword(currentPassword, dbUser.password);
      if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });
      data.password = await hashPassword(password);
    }
    if (theme) data.theme = theme;
    if (accentColor) data.accentColor = accentColor;
    if (columns !== undefined) data.columns = columns;
    const updated = await prisma.user.update({
      where: userWhere,
      data,
      select: { userID: true, username: true, email: true, role: true, theme: true, accentColor: true, updatedAt: true,
        permissions: {
          select: {
            viewOnly: true,
            createProcedureLog: true,
            editProcedureLog: true,
            editSettings: true,
            manageUsers: true,
          }
        }
      },
    });
    return res.status(200).json(updated);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

export default handler; 