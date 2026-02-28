/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'prisma'],
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.arc-testnet.example.com" },
    ],
  },
  experimental: {
    optimizePackageImports: [
      'wagmi',
      'recharts',
      'reactflow',
      'lucide-react',
    ],
  },
};

module.exports = nextConfig;
