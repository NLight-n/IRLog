import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Dynamic Web App Manifest endpoint.
 *
 * Serving the manifest from an API route lets us inject the correct
 * NEXT_PUBLIC_BASE_PATH at runtime so that `start_url`, `scope`, `id`,
 * icon `src` values, and shortcut URLs are all absolute paths.
 *
 * Chrome is stricter than Edge about scope matching — if any of these
 * are relative or resolve to the wrong directory the PWA gets an
 * out-of-scope blue bar at the top of the window.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  // Ensure scope always has a trailing slash so Chrome treats it as a directory
  const scope = basePath ? `${basePath}/` : '/';

  const manifest = {
    name: 'IRLog - Interventional Radiology Register',
    short_name: 'IRLog',
    description:
      'Interventional Radiology Register, Procedure Logger, and Appointment Scheduler',
    // `id` must be stable across deploys — use the scope so Chrome
    // recognises the same PWA even if the domain changes.
    id: scope,
    start_url: scope,
    scope: scope,
    display: 'standalone',
    orientation: 'any',
    background_color: '#18181b',
    theme_color: '#3b82f6',
    categories: ['medical', 'health', 'productivity'],
    icons: [
      {
        src: `${basePath}/icons/icon-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icons/icon-192x192-maskable.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${basePath}/icons/icon-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icons/icon-512x512-maskable.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Procedure Log',
        short_name: 'Log',
        description: 'View procedure logs',
        url: `${basePath}/`,
      },
      {
        name: 'Appointments Worklist',
        short_name: 'Appointments',
        description: 'View scheduled IR appointments',
        url: `${basePath}/worklist`,
      },
      {
        name: 'Analytics & Statistics',
        short_name: 'Analytics',
        description: 'View procedure analytics and reports',
        url: `${basePath}/analytics`,
      },
    ],
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).json(manifest);
}
