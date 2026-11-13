// Every 50 minutes, refresh each live receptionist's cached AI prompt (1-hour cache) so the first
// reply of a call isn't slowed by a cold cache. A refresh is a cheap cache read with no reply generated.
import { createAdminClient } from '../../lib/supabase/admin.js';
import { calendarConfigured } from '../../lib/gcal.js';
import { warmPhoneCache } from '../../lib/receptionist.js';

export default async () => {
    if (!process.env.ANTHROPIC_API_KEY) return new Response('not configured');
    const db = createAdminClient();
    const { data: subs, error } = await db.from('subaccounts').select('*').eq('receptionist_enabled', true);
    if (error) {
        console.error('warm-ai-cache: subaccounts query failed', error.message);
        return new Response('db error');
    }
    const results = [];
    for (const sub of subs || []) {
        try {
            // Same tool set the call uses (calendar tools only when a calendar is connected).
            const r = await warmPhoneCache({ ...sub, calendar_enabled: calendarConfigured(sub) });
            results.push(`${sub.name}: read ${r.read}, written ${r.written}`);
        } catch (err) {
            console.error('warm-ai-cache failed', sub.name, err.message);
            results.push(`${sub.name}: error`);
        }
    }
    console.log('warm-ai-cache', results.join('; '));
    return new Response(results.join('\n') || 'no live receptionists');
};

export const config = { schedule: '*/50 * * * *' };
