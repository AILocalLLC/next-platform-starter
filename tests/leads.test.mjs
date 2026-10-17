import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmationText, upsertLead } from '../lib/leads.js';
import { buildTools, buildSystemPrompt } from '../lib/receptionist.js';

function fakeDb() {
    const writes = [];
    const chain = (op) => ({
        eq: () => chain(op),
        select: () => chain(op),
        single: async () => ({ data: { id: 'c1' }, error: null })
    });
    return {
        writes,
        from: () => ({
            insert: (row) => (writes.push(['insert', row]), chain('insert')),
            update: (row) => (writes.push(['update', row]), chain('update'))
        })
    };
}

test('callback request tags the contact and notes service and address', async () => {
    const db = fakeDb();
    await upsertLead(db, {
        subaccountId: 's1',
        lead: { name: 'John', reason: 'Leaking gutter', service: 'gutter repair', address: '1 Main St, Massillon OH 44646', callback_requested: true },
        fallbackPhone: '+13305550000',
        source: 'ai_receptionist'
    });
    const [op, row] = db.writes[0];
    assert.equal(op, 'insert');
    assert.deepEqual(row.tags, ['callback-requested']);
    assert.equal(row.phone, '+13305550000');
    assert.match(row.notes, /Service: gutter repair/);
    assert.match(row.notes, /Address: 1 Main St/);
    assert.match(row.notes, /Requested a live callback/);
});

test('update without the flag does not clear an existing tag', async () => {
    const db = fakeDb();
    await upsertLead(db, { subaccountId: 's1', contactId: 'c1', lead: { name: 'John', reason: 'x' }, source: 'ai_receptionist' });
    assert.equal('tags' in db.writes[0][1], false);
});

test('save_lead exposes service, address, callback fields; prompt explains booking', () => {
    const props = Object.keys(buildTools({ name: 'X' })[0].input_schema.properties);
    for (const k of ['service', 'address', 'callback_time', 'callback_requested']) assert.ok(props.includes(k), k);
    assert.match(buildSystemPrompt({ name: 'X' }), /cannot book calendar appointments/);
});

test('caller confirmation text', () => {
    assert.equal(
        confirmationText({ name: 'New Gutters Near Me' }, { name: 'John Smith' }),
        'Thanks John! New Gutters Near Me got your request. A team member will reach out within a few hours to confirm. Reply STOP to opt out.'
    );
    assert.match(confirmationText({ name: 'X' }, { name: '' }), /^Thanks! X got/);
    assert.equal(confirmationText({ name: 'NGNM' }, { name: 'Ann' }, 'Monday, October 5 at 11:00 AM'), 'Thanks Ann! Your NGNM appointment is booked for Monday, October 5 at 11:00 AM. Reply STOP to opt out.');
});

test('call summary is appended to contact notes without markdown', async () => {
    const { notesWithSummary } = await import('../lib/leads.js');
    const at = '2026-10-14T20:40:00Z';
    assert.equal(notesWithSummary('Service: Gutter guards', '**Call summary**\nWants new gutters plus guards at 882 Seneca St.', at),
        'Service: Gutter guards\n\nCall summary (Oct 14, 2026):\nWants new gutters plus guards at 882 Seneca St.');
    assert.equal(notesWithSummary('', 'Callback requested.', at), 'Call summary (Oct 14, 2026):\nCallback requested.');
    assert.equal(notesWithSummary('x', 'Summary unavailable.', at), null);
    assert.equal(notesWithSummary('x', '', at), null);
});

test('cleanSummary strips markdown and the leading Summary label', async () => {
    const { cleanSummary } = await import('../lib/leads.js');
    assert.equal(cleanSummary('**Summary:** Pat Cutover wants new gutters.\n\nPat asked for a **callback**.'),
        'Pat Cutover wants new gutters.\n\nPat asked for a callback.');
    assert.equal(cleanSummary('## Call Summary\nCallback requested.'), 'Callback requested.');
    assert.equal(cleanSummary('Summary unavailable.'), 'Summary unavailable.');
    assert.equal(cleanSummary(null), '');
});
