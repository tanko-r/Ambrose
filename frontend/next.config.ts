import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output enables .next/standalone for Docker deployment
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    // BACKEND_URL (not NEXT_PUBLIC_BACKEND_URL) — rewrites are server-side only,
    // no need to expose this to the browser bundle. Falls back to localhost for local dev.
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5002';
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
