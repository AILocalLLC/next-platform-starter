/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        // Contact CSV imports
        serverActions: { bodySizeLimit: '10mb' }
    }
};

module.exports = nextConfig;
