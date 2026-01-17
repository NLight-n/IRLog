import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma/prisma';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const settings = await prisma.systemSettings.findUnique({
            where: { id: 1 },
            select: {
                appLogoData: true,
                appLogoMimeType: true,
            },
        });

        if (!settings?.appLogoData || !settings?.appLogoMimeType) {
            return res.status(404).json({ error: 'No logo found' });
        }

        // Convert Prisma Bytes to Buffer if needed
        const buffer = Buffer.isBuffer(settings.appLogoData)
            ? settings.appLogoData
            : Buffer.from(settings.appLogoData);

        // Set cache headers for performance
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        res.setHeader('Content-Type', settings.appLogoMimeType);
        res.setHeader('Content-Length', buffer.length);

        // Send binary data
        return res.send(buffer);
    } catch (error) {
        console.error('Logo fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch logo' });
    }
}
