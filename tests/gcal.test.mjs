import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { bookingSettings, computeSlots, createCalendar, slotLabel, zonedToUtc } from '../lib/gcal.js';
import { buildTools, runTurn } from '../lib/receptionist.js';

const ET = 'America/New_York';
const settings = bookingSettings({ timezone: ET, appointment_minutes: 60, booking_days: '1,2,3,4,5', booking_start: '09:00', booking_end: '17:00', booking_notice_hours: 12 });

test('zonedToUtc handles EDT and EST', () => {
    assert.equal(new Date(zonedToUtc(2026, 10, 5, 9, 0, ET)).toISOString(), '2026-10-05T13:00:00.000Z'); // EDT
    assert.equal(new Date(zonedToUtc(2026, 12, 7, 9, 0, ET)).toISOString(), '2026-12-07T14:00:00.000Z'); // EST
});

test('slots skip weekends, notice window and busy times', () => {
    const now = Date.parse('2026-10-02T14:00:00Z'); // Fri 10:00 ET -> earliest Fri 22:00 ET, so Friday is out
    const busy = [{ start: '2026-10-05T13:00:00Z', end: '2026-10-05T14:30:00Z' }]; // Mon 9:00-10:30 ET
    const slots = computeSlots({ busy, settings, now });
    assert.deepEqual(slots, [
        '2026-10-05T15:00:00.000Z', // Mon 11:00 (10:00 overlaps busy until 10:30)
        '2026-10-05T16:00:00.000Z',
        '2026-10-06T13:00:00.000Z', // Tue 9:00
        '2026-10-06T14:00:00.000Z',
        '2026-10-07T13:00:00.000Z',
        '2026-10-07T14:00:00.000Z'
    ]);
    assert.equal(slotLabel(slots[0], ET), 'Monday, October 5 at 11:00 AM');
});

test('onlyDate lists that day; last slot ends by closing time', () => {
    const now = Date.parse('2026-10-02T14:00:00Z');
    const slots = computeSlots({ busy: [], settings, now, onlyDate: '2026-10-06', perDay: 100, maxDays: 1 });
    assert.equal(slots.length, 8);
    assert.equal(slots.at(-1), '2026-10-06T20:00:00.000Z'); // 16:00 ET, ends 17:00
});

function fakeGoogle({ busy = [] } = {}) {
    const calls = [];
    const fetchImpl = async (url, init) => {
        calls.push({ url, body: init.body });
        const json = (data, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => data });
        if (url.includes('oauth2')) return json({ access_token: 'tok', expires_in: 3600 });
        if (url.endsWith('/freeBusy')) return json({ calendars: { 'me@gmail.com': { busy } } });
        if (url.includes('/events')) return json({ id: 'evt1' });
        return json({}, false);
    };
    return { calls, fetchImpl };
}

test('calendar books only open, valid slots and sends auth + event', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GOOGLE_CLIENT_EMAIL = 'bot@proj.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n');
    const now = Date.parse('2026-10-02T14:00:00Z');
    const g = fakeGoogle({ busy: [{ start: '2026-10-06T13:00:00Z', end: '2026-10-06T14:00:00Z' }] });
    const cal = createCalendar({ calendar_id: 'me@gmail.com', timezone: ET }, g.fetchImpl);

    const booked = await cal.book({ start: '2026-10-06T15:00:00.000Z', summary: 'Estimate: John', description: 'x', now });
    assert.equal(booked.eventId, 'evt1');
    assert.equal(booked.label, 'Tuesday, October 6 at 11:00 AM');
    const ev = JSON.parse(g.calls.find((c) => c.url.includes('/events')).body);
    assert.equal(ev.end.dateTime, '2026-10-06T16:00:00.000Z');
    const assertion = new URLSearchParams(g.calls.find((c) => c.url.includes('oauth2')).body).get('assertion');
    assert.equal(assertion.split('.').length, 3);

    await assert.rejects(cal.book({ start: '2026-10-06T13:00:00.000Z', summary: 's', description: 'd', now }), /not available/); // busy
    await assert.rejects(cal.book({ start: '2026-10-06T12:00:00.000Z', summary: 's', description: 'd', now }), /not available/); // 8am, before hours
    await assert.rejects(cal.book({ start: '2026-10-10T14:00:00.000Z', summary: 's', description: 'd', now }), /not available/); // Saturday
});

test('receptionist offers and books via calendar tools', async () => {
    const sub = { name: 'NGNM', calendar_enabled: true };
    assert.deepEqual(buildTools(sub).map((t) => t.name), ['save_lead', 'end_call', 'check_availability', 'book_appointment']);
    assert.deepEqual(buildTools(sub, 'web').map((t) => t.name), ['save_lead', 'check_availability', 'book_appointment']);

    const responses = [
        { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'check_availability', input: {} }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'I have Monday at 11 or Tuesday at 9.' }] },
        { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'book_appointment', input: { start: 'S1', name: 'John', reason: 'leak' } }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: "You're booked." }] }
    ];
    const client = { beta: { messages: { create: async () => responses.shift() } } };
    const calendar = { findSlots: async () => [{ start: 'S1', label: 'Monday at 11' }] };
    const booked = [];
    const onBook = async (input) => (booked.push(input), { label: 'Monday at 11' });

    let r = await runTurn({ subaccount: sub, messages: [], callerText: 'book me', onSaveLead: async () => {}, calendar, onBook, client });
    assert.match(r.messages[2].content[0].content, /S1/);
    r = await runTurn({ subaccount: sub, messages: r.messages, callerText: 'Monday', onSaveLead: async () => {}, calendar, onBook, client });
    assert.equal(booked[0].start, 'S1');
    assert.equal(r.reply, "You're booked.");
});

test('private key accepted with or without header lines and escaped newlines', async () => {
    const { createPrivateKey, generateKeyPairSync: gen } = await import('node:crypto');
    const { normalizePrivateKey } = await import('../lib/gcal.js');
    const pem = gen('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
    const body = pem.split('\n').filter((l) => l && !l.includes('PRIVATE KEY')).join('');
    for (const variant of [pem, pem.replace(/\n/g, '\\n'), `"${pem.replace(/\n/g, '\\n')}"`, body, body.match(/.{1,64}/g).join('\\n')]) {
        assert.doesNotThrow(() => createPrivateKey(normalizePrivateKey(variant)));
    }
});

test('booking rule comes after owner instructions when calendar is connected', async () => {
    const { buildSystemPrompt } = await import('../lib/receptionist.js');
    const p = buildSystemPrompt({ name: 'NGNM', instructions: 'STEP 7: ask which day and time works best.', calendar_enabled: true });
    assert.ok(p.indexOf('<booking>') > p.indexOf('</owner_instructions>'));
    assert.match(p, /call check_availability first/);
    assert.doesNotMatch(buildSystemPrompt({ name: 'NGNM' }), /<booking>/);
});
