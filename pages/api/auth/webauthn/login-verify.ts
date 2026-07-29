import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ ok: false, error: 'Credential ID is required.' });
  }

  try {
    const authenticator = await prisma.authenticator.findUnique({
      where: { credentialID: id },
      include: { user: true },
    });

    if (!authenticator || !authenticator.user) {
      return res.status(404).json({ ok: false, error: 'Biometric credential not recognized or user not found.' });
    }

    // Increment counter
    await prisma.authenticator.update({
      where: { id: authenticator.id },
      data: { counter: authenticator.counter + 1 },
    });

    return res.status(200).json({
      ok: true,
      username: authenticator.user.username,
      userID: authenticator.user.userID,
      role: authenticator.user.role,
    });
  } catch (err: any) {
    console.error('Error verifying WebAuthn login assertion:', err);
    return res.status(500).json({ ok: false, error: 'Failed to authenticate biometric assertion.' });
  }
}
