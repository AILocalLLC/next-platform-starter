// White-label branding. Override per deployment with env vars.
export const brand = {
    name: process.env.NEXT_PUBLIC_BRAND_NAME || 'AiLocal',
    domain: process.env.NEXT_PUBLIC_BRAND_DOMAIN || 'ailocal.net',
    tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || 'AI receptionists that answer every call for local businesses.',
    logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || '',
    color: process.env.NEXT_PUBLIC_BRAND_COLOR || '#2563eb',
    supportEmail: process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL || 'support@ailocal.net'
};
