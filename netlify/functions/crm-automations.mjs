// Every 5 minutes, ask the CRM to run its automation steps that are due
// (texts, waits, tags). The CRM sends the texts back through /api/sms/send.
export default async () => {
    const key = process.env.LEAD_ALERT_KEY;
    if (!key) return new Response('not configured', { status: 200 });
    const base = (process.env.CRM_API_URL || 'https://api-596595914790.us-central1.run.app').replace(/\/$/, '');
    try {
        const res = await fetch(`${base}/api/v1/automations/tick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-lead-alert-key': key },
            body: '{}',
            signal: AbortSignal.timeout(25000)
        });
        const text = await res.text();
        if (!res.ok) console.error('CRM automation tick failed', res.status, text.slice(0, 200));
        return new Response(`tick ${res.status} ${text.slice(0, 200)}`);
    } catch (err) {
        console.error('CRM automation tick error', err.message);
        return new Response('tick error', { status: 200 });
    }
};

export const config = { schedule: '*/5 * * * *' };
