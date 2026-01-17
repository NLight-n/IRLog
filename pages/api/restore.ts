import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { spawn } from 'child_process';
import { IncomingForm, File } from 'formidable';
import fs from 'fs';

export const config = {
    api: {
        bodyParser: false,
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

// Parse form data
function parseForm(req: NextApiRequest): Promise<{ file: File }> {
    return new Promise((resolve, reject) => {
        const form = new IncomingForm({
            maxFileSize: 100 * 1024 * 1024, // 100MB limit
            keepExtensions: true,
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                reject(err);
                return;
            }

            const file = files.file;
            if (!file) {
                reject(new Error('No file uploaded'));
                return;
            }

            // Handle array of files (formidable v3)
            const uploadedFile = Array.isArray(file) ? file[0] : file;
            resolve({ file: uploadedFile });
        });
    });
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Only allow POST requests
    if (req.method !== 'POST') {
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

        // Parse the uploaded file
        const { file } = await parseForm(req);

        // Read the SQL file content
        const sqlFilePath = file.filepath;

        // Execute psql to restore the database
        const psql = spawn('psql', [
            '-h', dbConfig.host,
            '-p', dbConfig.port,
            '-U', dbConfig.user,
            '-d', dbConfig.database,
            '-f', sqlFilePath,
        ], {
            env: {
                ...process.env,
                PGPASSWORD: dbConfig.password,
            },
        });

        let stderr = '';

        psql.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        await new Promise<void>((resolve, reject) => {
            psql.on('close', (code) => {
                // Clean up the uploaded file
                fs.unlink(sqlFilePath, () => { });

                if (code !== 0) {
                    console.error('psql stderr:', stderr);
                    reject(new Error(`Database restore failed with code ${code}`));
                } else {
                    resolve();
                }
            });

            psql.on('error', (error) => {
                // Clean up the uploaded file
                fs.unlink(sqlFilePath, () => { });
                reject(error);
            });
        });

        return res.status(200).json({ success: true, message: 'Database restored successfully' });

    } catch (error) {
        console.error('Restore error:', error);
        const message = error instanceof Error ? error.message : 'Failed to restore database';
        return res.status(500).json({ error: message });
    }
}
