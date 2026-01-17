import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { spawn } from 'child_process';

export const config = {
    api: {
        responseLimit: false,
    },
};

// Parse DATABASE_URL to extract connection details
function parseDatabaseUrl(url: string) {
    // Format: postgresql://user:password@host:port/database
    const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
    const match = url.match(regex);

    if (!match) {
        throw new Error('Invalid DATABASE_URL format');
    }

    return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: match[4],
        database: match[5].split('?')[0], // Remove query params if any
    };
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check authentication and admin permissions
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as { permissions?: { manageUsers?: boolean } };
    if (!user.permissions?.manageUsers) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    try {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            return res.status(500).json({ error: 'DATABASE_URL not configured' });
        }

        const dbConfig = parseDatabaseUrl(databaseUrl);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `irlog_backup_${timestamp}.sql`;

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Spawn pg_dump process
        const pgDump = spawn('pg_dump', [
            '-h', dbConfig.host,
            '-p', dbConfig.port,
            '-U', dbConfig.user,
            '-d', dbConfig.database,
            '--clean',
            '--if-exists',
            '--no-owner',
            '--no-privileges',
        ], {
            env: {
                ...process.env,
                PGPASSWORD: dbConfig.password,
            },
        });

        // Pipe stdout to response
        pgDump.stdout.pipe(res);

        // Handle errors
        pgDump.stderr.on('data', (data) => {
            console.error('pg_dump stderr:', data.toString());
        });

        pgDump.on('error', (error) => {
            console.error('pg_dump error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to execute pg_dump' });
            }
        });

        pgDump.on('close', (code) => {
            if (code !== 0 && !res.headersSent) {
                res.status(500).json({ error: `pg_dump exited with code ${code}` });
            }
        });

    } catch (error) {
        console.error('Backup error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to create backup' });
        }
    }
}
