import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features if needed
  },
  transpilePackages: ['@turn-based-mcp/shared'],
  turbopack: {
    // This is a workspace (monorepo): pin the root explicitly so Turbopack
    // doesn't try to infer it from a lockfile elsewhere on disk.
    root: path.join(__dirname, '..'),
  },
};

export default nextConfig;
