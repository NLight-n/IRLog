import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  // Enforce trailing slashes so every page URL stays within the PWA
  // manifest scope (e.g. /irlog/ instead of /irlog). Chrome shows an
  // out-of-scope blue bar when the page URL lacks the trailing slash.
  trailingSlash: true,
};

export default nextConfig;
