import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callInboxEvent, crmLeadFromContact, keyMatches, leadAlertText, pushInboxEvent, pushLeadToCrm, smsInboxEvent, voicemailInboxEvent } from '../lib/crm.js';

test('keyMatches only accepts the exact key', () => {
    assert.equal(keyMatches('abc', 'abc'), true);
    assert.equal(keyMatches('abd', 'abc'), false);
    assert.equal(keyMatches('', 'abc'), false);
    assert.equal(keyMatches('abc', undefined), false);
});

test('crmLeadFromContact splits the name and pulls address and service from notes', () => {
    const lead = crmLeadFromContact('ngnm-website-quote', {
        name: 'Mary Ann Smith', phone: '+13305551234', email: null,
        notes: 'Service: Gutter guards\nAddress: 12 Main St, Massillon\nWants a quote'
    }, 'Caller wants guards.', 'phone');
    assert.deepEqual(lead, {
        slug: 'ngnm-website-quote', firstName: 'Mary', lastName: 'Ann Smith', phone: '+13305551234', email: undefined,
        address: '12 Main St, Massillon', jobType: 'Gutter guards', notes: 'Caller wants guards.', source: 'Ari phone call'
    });
    assert.equal(crmLeadFromContact('s', { name: '' }, 'Summary unavailable.', 'web').firstName, 'Lead');
    assert.equal(crmLeadFromContact('s', { name: '' }, 'Summary unavailable.', 'web').notes, undefined);
    assert.equal(crmLeadFromContact('s', { name: '' }, '', 'web').source, 'Ari website chat');
});

test('pushLeadToCrm posts to the CRM intake with the key, and skips when not configured', async () => {
    let call;
    const env = { LEAD_ALERT_KEY: 'k', CRM_API_URL: 'https://crm.test/' };
    assert.equal(await pushLeadToCrm({ slug: 's' }, { env, fetchImpl: async (url, o) => { call = { url, o }; return { ok: true }; } }), 'sent');
    assert.equal(call.url, 'https://crm.test/api/v1/funnels/capture');
    assert.equal(call.o.headers['x-lead-alert-key'], 'k');
    assert.equal(await pushLeadToCrm({}, { env: {}, fetchImpl: () => { throw new Error('no'); } }), 'not-configured');
    await assert.rejects(pushLeadToCrm({}, { env, fetchImpl: async () => ({ ok: false, status: 500 }) }));
});

test('leadAlertText reads well for a website lead', () => {
    const t = leadAlertText({ slug: 's', firstName: 'Jo', lastName: 'Doe', phone: '(330) 555-1234', address: '1 Elm St', jobType: 'New Gutters', notes: 'Back of house', source: 'website / ngnm-website-quote', smsConsentText: 'x' });
    assert.equal(t, 'New lead (website form): Jo Doe\nPhone: (330) 555-1234\nAddress: 1 Elm St\nJob: New Gutters\nNotes: Back of house');
    assert.equal(leadAlertText({ firstName: 'Lead', source: 'Referral from Bob' }), 'New lead (Referral from Bob): No name');
});

test('automationText sends the body live, and marks test texts with the lead', async () => {
    const { automationText } = await import('../lib/crm.js');
    assert.equal(automationText({ body: ' Hi Kurt ', test: false }), 'Hi Kurt');
    assert.equal(automationText({ body: 'Hi Kurt', test: true, contactName: 'Kurt Matie', to: '+13308442536' }), 'TEST (would go to Kurt Matie +13308442536): Hi Kurt');
    assert.equal(automationText({ body: 'Hi', test: true }), 'TEST (would go to lead): Hi');
});


test('inbox events carry the business and the customer', () => {
    const sub = { crm_funnel_slug: 'ngnm-website-quote', twilio_number: '+13305550000' };
    assert.deepEqual(smsInboxEvent(sub, { direction: 'in', phone: '+13305550101', body: 'Hi', sid: 'SM1', name: 'Kurt' }), {
        type: 'sms', direction: 'in', phone: '+13305550101', name: 'Kurt', body: 'Hi', media: [], externalId: 'SM1', slug: 'ngnm-website-quote', business: '+13305550000'
    });
    const call = callInboxEvent(sub, { id: 'c1', channel: 'phone', from_number: '+13305550102', duration_seconds: 125, started_at: '2026-10-22T15:00:00Z' }, null, 'Wants gutters.');
    assert.equal(call.type, 'call');
    assert.equal(call.phone, '+13305550102');
    assert.equal(call.externalId, 'call:c1');
    assert.match(call.body, /^Call answered by the AI receptionist \(2 min\)\. Wants gutters\.$/);
    const chat = callInboxEvent(sub, { id: 'c2', channel: 'web' }, { name: 'Ann', email: 'a@b.co' }, 'Asked about pricing.');
    assert.equal(chat.type, 'chat');
    assert.equal(chat.phone, undefined);
    assert.equal(chat.email, 'a@b.co');
    assert.equal(voicemailInboxEvent(sub, { id: 'c3', from_number: '+1330' }, 'Call me').externalId, 'vm:c3');
});

test('pushInboxEvent posts with the key and never throws', async () => {
    const env = { LEAD_ALERT_KEY: 'k'.repeat(40), CRM_API_URL: 'https://crm.test/' };
    let call;
    const ev = { type: 'sms', direction: 'in', phone: '+1', body: 'x', slug: 's' };
    assert.equal(await pushInboxEvent(ev, { env, fetchImpl: async (url, opts) => { call = { url, opts }; return { ok: true }; } }), 'sent');
    assert.equal(call.url, 'https://crm.test/api/v1/inbox/events');
    assert.equal(call.opts.headers['x-lead-alert-key'], env.LEAD_ALERT_KEY);
    assert.equal(await pushInboxEvent(ev, { env, fetchImpl: async () => { throw new Error('down'); } }), 'error');
    assert.equal(await pushInboxEvent(ev, { env, fetchImpl: async () => ({ ok: false, status: 500 }) }), 'http-500');
    assert.equal(await pushInboxEvent(ev, { env: {} }), 'not-configured');
    assert.equal(await pushInboxEvent({ ...ev, slug: undefined }, { env }), 'no-business');
    assert.equal(await pushInboxEvent({ ...ev, phone: undefined }, { env }), 'no-contact');
});
