import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { IncomingForm, File } from 'formidable';
import fs from 'fs';
import { prisma } from '../../lib/prisma/prisma';

export const config = {
    api: {
        bodyParser: false,
    },
};

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB limit

// Parse form data
function parseForm(req: NextApiRequest): Promise<{ file: File }> {
    return new Promise((resolve, reject) => {
        const form = new IncomingForm({
            maxFileSize: MAX_FILE_SIZE,
            keepExtensions: true,
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                if (err.code === 1009) {
                    reject(new Error('File too large. Maximum size is 1MB.'));
                } else {
                    reject(err);
                }
                return;
            }

            const file = files.file;
            if (!file) {
                reject(new Error('No file uploaded'));
                return;
            }

            const uploadedFile = Array.isArray(file) ? file[0] : file;
            resolve({ file: uploadedFile });
        });
    });
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Check authentication and admin permissions
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as { permissions?: { manageUsers?: boolean } };
    if (!user.permissions?.manageUsers) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    if (req.method === 'POST') {
        try {
            const { file } = await parseForm(req);

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
                fs.unlinkSync(file.filepath);
                return res.status(400).json({ error: 'Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.' });
            }

            // Read file as binary
            const fileBuffer = fs.readFileSync(file.filepath);

            // Clean up temp file
            fs.unlinkSync(file.filepath);

            // Store binary data in database
            await prisma.systemSettings.update({
                where: { id: 1 },
                data: {
                    appLogoData: fileBuffer,
                    appLogoMimeType: file.mimetype,
                },
            });

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Logo upload error:', error);
            const message = error instanceof Error ? error.message : 'Failed to upload logo';
            return res.status(500).json({ error: message });
        }
    }

    if (req.method === 'DELETE') {
        try {
            await prisma.systemSettings.update({
                where: { id: 1 },
                data: {
                    appLogoData: null,
                    appLogoMimeType: null,
                },
            });

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('Logo delete error:', error);
            return res.status(500).json({ error: 'Failed to delete logo' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
