import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma/prisma';

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const referringPhysicians = await prisma.physician.findMany({
        where: {
          role: 'REFERRER',
        },
      });
      res.json(referringPhysicians);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching referring physicians' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
