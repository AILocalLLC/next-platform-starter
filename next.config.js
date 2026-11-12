/** @type {import('next').NextConfig} */

// Safe on every page.
const baseHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }
];

// No other site may frame the app (clickjacking).
const noFraming = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }
];

const nextConfig = {
    reactStrictMode: true,
    experimental: {
        // Contact CSV imports
        serverActions: { bodySizeLimit: '10mb' }
    },
    async headers() {
        return [
            { source: '/(.*)', headers: baseHeaders },
            // Not the chat widget: widget.js and /api/chat are used from customers' websites.
            { source: '/:path((?!widget\\.js$|api/chat/).*)', headers: noFraming }
        ];
    }
};

module.exports = nextConfig;
