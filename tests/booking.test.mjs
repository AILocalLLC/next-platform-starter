import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { bookingContext } from '../lib/booking.js';

// Fake Google + fake CRM behind the global fetch; a tiny stand-in for the Supabase client.
function setup({ assignee = null, crmDown = false } = {}) {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GOOGLE_CLIENT_EMAIL = 'bot@proj.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n');
    process.env.LEAD_ALERT_KEY = 'k'.repeat(40);
    process.env.CRM_API_URL = 'https://crm.test';
    const seen = { freeBusy: [], events: [], lookups: [], crmEvents: [] };
    globalThis.fetch = async (url, init = {}) => {
        const json = (data, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => data });
        const body = init.body && typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : null;
        if (url.includes('oauth2')) return json({ access_token: 'tok', expires_in: 3600 });
        if (url.endsWith('/freeBusy')) {
            const id = body.items[0].id;
            seen.freeBusy.push(id);
            return json({ calendars: { [id]: { busy: [] } } });
        }
        if (url.includes('/calendars/') && url.includes('/events')) {
            seen.events.push(decodeURIComponent(url.split('/calendars/')[1].split('/')[0]));
            if (body?.summary) (seen.titles ||= []).push(body.summary);
            return json({ id: `evt${seen.events.length}` });
        }
        if (url.endsWith('/api/v1/platform/booking-calendar')) {
            seen.lookups.push(body);
            if (crmDown) throw new Error('down');
            return json(assignee && String(body.phone).replace(/\D/g, '').slice(-10) === '3305550101' ? assignee : {});
        }
        if (url.endsWith('/api/v1/appointments/events')) {
            seen.crmEvents.push(body);
            return json({});
        }
        return json({}, false);
    };
    const inserted = [];
    const db = {
        from: (table) => ({
            insert: (row) => {
                if (table === 'appointments') { inserted.push(row); return Promise.resolve({ error: null }); }
                return { select: () => ({ single: async () => ({ data: { id: 'contact-1' }, error: null }) }) };
            },
            update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'contact-1' }, error: null }) }) }) })
        })
    };
    const sub = { id: 's1', name: 'NGNM', calendar_id: 'sales@ngnm.com', timezone: 'America/New_York', crm_funnel_slug: 'ngnm-website-quote', twilio_number: '+13309196167', appointment_minutes: 60, booking_days: '0,1,2,3,4,5,6', booking_start: '00:00', booking_end: '23:59', booking_notice_hours: 0 };
    return { seen, inserted, db, sub };
}

const rita = { calendarId: 'rita@gmail.com', assignedToId: 'u-rita', name: 'Rita Rep' };

test('phone call from a caller assigned to Rita: Ari checks and books on Rita\'s calendar', async () => {
    const { seen, inserted, db, sub } = setup({ assignee: rita });
    const ctx = bookingContext({ db, subaccount: sub, callId: 'c1', fallbackPhone: '+13305550101', source: 'ai_receptionist', state: {} });
    const slots = await ctx.calendar.findSlots({});
    assert.ok(slots.length > 0);
    assert.deepEqual(seen.freeBusy, ['rita@gmail.com']);
    const booked = await ctx.onBook({ start: slots[0].start, name: 'Kurt Lead', service: 'Estimate' });
    assert.equal(seen.events.at(-1), 'rita@gmail.com', 'event created on Rita\'s calendar');
    assert.equal(seen.titles.at(-1), 'NGNM – Estimate: Kurt Lead', 'business name first, so a shared calendar shows whose appointment it is');
    assert.equal(seen.lookups.length, 1, 'looked up once per turn');
    assert.equal(inserted[0].google_calendar_id, 'rita@gmail.com');
    assert.equal(inserted[0].crm_assignee_id, 'u-rita');
    assert.deepEqual([booked.calendarId, booked.assignedToId], ['rita@gmail.com', 'u-rita']);
});

test('unassigned caller, or the CRM unreachable: business calendar, as before', async () => {
    for (const opts of [{ assignee: null }, { assignee: rita, crmDown: true }]) {
        const { seen, inserted, db, sub } = setup(opts);
        const ctx = bookingContext({ db, subaccount: sub, callId: 'c1', fallbackPhone: '+13305550101', source: 'ai_receptionist', state: {} });
        const slots = await ctx.calendar.findSlots({});
        await ctx.onBook({ start: slots[0].start, name: 'Nora' });
        assert.deepEqual(seen.freeBusy, ['sales@ngnm.com', 'sales@ngnm.com']);
        assert.equal(seen.events.at(-1), 'sales@ngnm.com');
        assert.equal(inserted[0].google_calendar_id, null);
        assert.equal(inserted[0].crm_assignee_id, null);
    }
});

test('website chat: the visitor gives their number at booking time, so the lookup uses it', async () => {
    const { seen, db, sub } = setup({ assignee: rita });
    const ctx = bookingContext({ db, subaccount: sub, callId: 'w1', fallbackPhone: null, source: 'website_chat', state: {} });
    const slots = await ctx.calendar.findSlots({});
    assert.deepEqual(seen.lookups, [], 'no number yet, no lookup');
    await ctx.onBook({ start: slots[0].start, name: 'Kurt Lead', phone: '(330) 555-0101' });
    assert.equal(seen.lookups.at(-1).phone, '(330) 555-0101');
    assert.equal(seen.events.at(-1), 'rita@gmail.com');
    assert.equal(seen.crmEvents[0].calendarId, 'rita@gmail.com', 'CRM told whose calendar');
    assert.equal(seen.crmEvents[0].assignedToId, 'u-rita');
});
