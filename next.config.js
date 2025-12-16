/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  // output: 'export', // Désactivé pour permettre les API routes (import/export)
  // Remplacer 'koma_BBDR' par le nom exact de votre repo GitHub
  // basePath: isProd ? '/koma_BBDR' : '', // Désactivé en mode serveur
  // assetPrefix: isProd ? '/koma_BBDR/' : '', // Désactivé en mode serveur
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

module.exports = nextConfig;
