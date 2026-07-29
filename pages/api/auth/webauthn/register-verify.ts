import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = session.user as any;
  const userId = user.id || user.userID;
  const { id, rawId, clientDataJSON, attestationObject } = req.body;

  if (!id || !rawId) {
    return res.status(400).json({ error: 'Invalid credential payload.' });
  }

  try {
    // Upsert or create authenticator record for user in DB
    await prisma.authenticator.upsert({
      where: { credentialID: id },
      update: {
        userID: userId,
        credentialPublicKey: attestationObject || rawId,
      },
      create: {
        credentialID: id,
        userID: userId,
        credentialPublicKey: attestationObject || rawId,
        counter: 0,
        credentialDeviceType: 'platform',
      },
    });

    return res.status(200).json({ ok: true, message: 'Biometric credential registered successfully.' });
  } catch (err: any) {
    console.error('Error saving WebAuthn credential:', err);
    return res.status(500).json({ error: 'Failed to save biometric credential.' });
  }
}
