/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module: it must stay outside the bundle, and its
  // compiled binary has to be traced into the serverless function or the
  // deployed build cannot open a database at all.
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingIncludes: {
    '/**': ['./node_modules/better-sqlite3/build/Release/*.node'],
  },
  experimental: {
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
