// Downtime alerts. Every 5 minutes netlify/functions/uptime-check.mjs fetches each address below.
// Two failed checks in a row (about 10 minutes) text the owner once; the next good check texts
// that it is back. One blip never texts.

export const CHECKS = [
    { name: 'CRM', url: 'https://crm.ailocal.net/login' },
    { name: 'CRM API', url: 'https://api-596595914790.us-central1.run.app/health' },
    { name: 'Ari phone system', url: 'https://ailocal-platform.netlify.app/api/health' },
    { name: 'newguttersnearme.com', url: 'https://newguttersnearme.com/' },
    { name: 'ailocal.net', url: 'https://ailocal.net/' },
    { name: 'thermalroofing.net', url: 'https://thermalroofing.net/' }
];

export const FAILS_BEFORE_ALERT = 2;

export async function probe(url, fetchImpl = fetch, timeoutMs = 10000) {
    try {
        const res = await fetchImpl(url, { redirect: 'follow', cache: 'no-store', headers: { 'user-agent': 'AILocal-uptime/1.0' }, signal: AbortSignal.timeout(timeoutMs) });
        return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
    } catch (err) {
        return { ok: false, error: err?.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000}s` : 'unreachable' };
    }
}

const minutes = (from, to) => Math.max(1, Math.round((to - from) / 60000));

// Next state for one check, and the text to send (if any).
export function nextState(prev, result, now = new Date()) {
    const p = prev || { fail_count: 0, failing_since: null, alerted: false };
    if (result.ok) {
        const text = p.alerted && p.failing_since ? `back up after about ${minutes(new Date(p.failing_since), now)} min.` : null;
        return { state: { fail_count: 0, failing_since: null, alerted: false, last_error: null }, text };
    }
    const failCount = (p.fail_count || 0) + 1;
    const failingSince = p.failing_since || now.toISOString();
    const alert = !p.alerted && failCount >= FAILS_BEFORE_ALERT;
    return {
        state: { fail_count: failCount, failing_since: failingSince, alerted: p.alerted || alert, last_error: result.error },
        text: alert ? `DOWN (${result.error}) for about ${minutes(new Date(failingSince), now)} min.` : null
    };
}

export function alertMessage(name, text) {
    return `AI Local alert: ${name} ${text}`;
}
