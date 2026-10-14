/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        // unstable_after: warm the AI prompt cache after the call's first webhook responds
        after: true,
        // Contact CSV imports
        serverActions: { bodySizeLimit: '10mb' }
    }
};

module.exports = nextConfig;
