import { createAdminClient } from 'lib/supabase/admin';
import { keyMatches } from 'lib/crm';
import { calendarConfigured, createCalendar } from 'lib/gcal';
import { toE164 } from 'lib/phone';

// The CRM's calendar uses this to put its appointments on the business's Google
// Calendar (so the AI receptionist sees them as busy) and to show other events as busy.
// Body: { action: 'create'|'update'|'delete'|'busy', slug?|from?, eventId?, summary, description, location, start, end }
// Replies: { status: 'ok', eventId? , busy? } or { status: <reason> }.
export async function POST(request) {
    if (!keyMatches(request.headers.get('x-lead-alert-key'), process.env.LEAD_ALERT_KEY)) {
        return new Response('Forbidden', { status: 403 });
    }
    let msg;
    try {
        msg = await request.json();
    } catch {
        return Response.json({ status: 'bad-json' }, { status: 400 });
    }
    const action = msg?.action;
    if (!['create', 'update', 'delete', 'busy'].includes(action)) return Response.json({ status: 'bad-action' }, { status: 400 });

    const db = createAdminClient();
    let subaccount = null;
    if (msg.from) {
        const from = toE164(String(msg.from));
        if (from) ({ data: subaccount } = await db.from('subaccounts').select('*').eq('twilio_number', from).maybeSingle());
    }
    if (!subaccount && msg.slug) {
        ({ data: subaccount } = await db.from('subaccounts').select('*').eq('crm_funnel_slug', String(msg.slug)).maybeSingle());
    }
    if (!subaccount) return Response.json({ status: 'no-business' }, { status: 404 });
    if (!calendarConfigured(subaccount)) return Response.json({ status: 'no-calendar' }, { status: 409 });

    const valid = (t) => typeof t === 'string' && !Number.isNaN(Date.parse(t));
    const calendar = createCalendar(subaccount);
    try {
        if (action === 'busy') {
            if (!valid(msg.start) || !valid(msg.end)) return Response.json({ status: 'bad-range' }, { status: 400 });
            return Response.json({ status: 'ok', busy: await calendar.busyEvents(new Date(msg.start).toISOString(), new Date(msg.end).toISOString()) });
        }
        if (action === 'delete') {
            if (!msg.eventId) return Response.json({ status: 'missing-event' }, { status: 400 });
            await calendar.deleteEvent(String(msg.eventId));
            return Response.json({ status: 'ok' });
        }
        if (!valid(msg.start) || !valid(msg.end) || !msg.summary) return Response.json({ status: 'missing-fields' }, { status: 400 });
        const fields = {
            summary: String(msg.summary).slice(0, 300),
            description: msg.description ? String(msg.description).slice(0, 4000) : undefined,
            location: msg.location ? String(msg.location).slice(0, 500) : undefined,
            start: msg.start,
            end: msg.end
        };
        if (action === 'update') {
            if (!msg.eventId) return Response.json({ status: 'missing-event' }, { status: 400 });
            await calendar.updateEvent(String(msg.eventId), fields);
            return Response.json({ status: 'ok', eventId: String(msg.eventId) });
        }
        return Response.json({ status: 'ok', eventId: await calendar.createEvent(fields) });
    } catch (err) {
        console.error('calendar sync failed', action, err?.message);
        return Response.json({ status: `google-error: ${String(err?.message || 'unknown').slice(0, 150)}` }, { status: 502 });
    }
}
