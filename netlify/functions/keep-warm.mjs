// Every 5 minutes, wake the app's server function so a caller never waits through a cold start
// (the first webhook after an idle period took ~5s, heard as silence before the greeting).
export default async () => {
    const base = (process.env.URL || process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    if (!base) return new Response('no base url', { status: 500 });
    const res = await fetch(`${base}/api/health`, { headers: { 'cache-control': 'no-cache' } });
    return new Response(`health ${res.status}`);
};

export const config = { schedule: '*/5 * * * *' };
