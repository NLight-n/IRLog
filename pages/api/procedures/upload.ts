import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { minioClient, MINIO_BUCKET } from '../../../lib/storage/minio';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });
  const sess: any = session;
  if (!sess.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = sess.user;
  if (!user.permissions?.createProcedureLog && !user.permissions?.editProcedureLog) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ message: 'File upload error' });
    let file = files.file as any;
    if (Array.isArray(file)) file = file[0];
    let procedureID = fields.procedureID as string | string[] | undefined;
    if (Array.isArray(procedureID)) procedureID = procedureID[0];
    if (!file || !procedureID) return res.status(400).json({ message: 'Missing file or procedureID' });
    const fileStream = fs.createReadStream(file.filepath);
    const fileName = `procedure_${procedureID}_${Date.now()}_${file.originalFilename}`;
    await minioClient.putObject(MINIO_BUCKET, fileName, fileStream, file.size);
    const fileUrl = `/api/procedures/file/${fileName}`;
    return res.status(200).json({ fileUrl });
  });
} 