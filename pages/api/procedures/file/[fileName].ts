import { minioClient, MINIO_BUCKET } from '../../../../lib/storage/minio';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  const { fileName } = req.query;
  if (!fileName || typeof fileName !== 'string') {
    return res.status(400).json({ message: 'Missing fileName' });
  }
  try {
    const stream = await minioClient.getObject(MINIO_BUCKET, fileName);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    stream.pipe(res);
  } catch (e) {
    return res.status(404).json({ message: 'File not found' });
  }
} 