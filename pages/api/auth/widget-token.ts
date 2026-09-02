import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../lib/prisma/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // 1. Check if user has an active NextAuth session
    const sessionToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    let userId: number | null = null;
    let username: string | null = null;
    let role: string | null = null;

    if (sessionToken) {
      userId = parseInt(String(sessionToken.id || sessionToken.userID), 10);
      username = String(sessionToken.username || sessionToken.name || '');
      role = String(sessionToken.role || 'User');
    } else {
      // Or accept a direct validation payload (e.g. from WebAuthn verification endpoint)
      const { credentialId } = req.body || {};
      if (credentialId) {
        const authenticator = await prisma.authenticator.findUnique({
          where: { credentialID: credentialId },
          include: { user: true },
        });
        if (authenticator && authenticator.user) {
          userId = authenticator.user.userID;
          username = authenticator.user.username;
          role = authenticator.user.role;
        }
      }
    }

    if (!userId || !username) {
      return res.status(401).json({ message: 'Unauthorized: Valid session or biometric credential required' });
    }

    const secret = process.env.NEXTAUTH_SECRET || 'irlog_widget_fallback_secret_key';

    // Issue a 1-year widget token
    const widgetToken = jwt.sign(
      {
        id: userId,
        userID: userId,
        username,
        role,
        purpose: 'irlog_android_widget',
      },
      secret,
      { expiresIn: '365d' }
    );

    return res.status(200).json({
      ok: true,
      token: widgetToken,
      user: {
        userId,
        username,
        role,
      },
    });
  } catch (error: any) {
    console.error('Error generating widget token:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
