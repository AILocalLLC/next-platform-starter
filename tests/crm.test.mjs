import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crmLeadFromContact, keyMatches, leadAlertText, pushLeadToCrm } from '../lib/crm.js';

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
