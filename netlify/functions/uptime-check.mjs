import twilio from 'twilio';
import { createAdminClient } from '../../lib/supabase/admin.js';
import { CHECKS, alertMessage, nextState, probe } from '../../lib/uptime.js';

// Every 5 minutes: is the CRM, Ari's phone system and each website answering? Texts
// UPTIME_ALERT_TO from UPTIME_ALERT_FROM when something has been down ~10 minutes, and again when it's back.
export default async () => {
    const to = process.env.UPTIME_ALERT_TO;
    const from = process.env.UPTIME_ALERT_FROM;
    const db = createAdminClient();
    const { data: rows, error } = await db.from('uptime_checks').select('*');
    if (error) {
        console.error('uptime: state not readable', error.message);
        return new Response('state error', { status: 200 });
    }
    const byName = Object.fromEntries((rows || []).map((r) => [r.name, r]));
    const results = await Promise.all(CHECKS.map(async (c) => ({ c, result: await probe(c.url) })));
    const texts = [];
    const now = new Date();
    for (const { c, result } of results) {
        const { state, text } = nextState(byName[c.name], result, now);
        await db.from('uptime_checks').upsert({ name: c.name, ...state, updated_at: now.toISOString() });
        if (!result.ok) console.error(`uptime: ${c.name} failed (${result.error})`);
        if (text) texts.push(alertMessage(c.name, text));
    }
    if (texts.length && to && from) {
        try {
            await twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).messages.create({ from, to, body: texts.join('\n') });
        } catch (err) {
            console.error('uptime: alert text failed', err.message);
        }
    } else if (texts.length) console.error('uptime: UPTIME_ALERT_TO/FROM not set;', texts.join(' | '));
    return new Response(results.map(({ c, result }) => `${c.name}: ${result.ok ? 'ok' : result.error}`).join('\n'));
};

export const config = { schedule: '*/5 * * * *' };
