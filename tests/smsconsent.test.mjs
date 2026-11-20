import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONSENT_LINE, SMS_CONSENT } from '../lib/smsConsent.js';
import { buildSystemPrompt } from '../lib/receptionist.js';

test('each consent page has what carriers check: opt-in line, STOP/HELP sample, privacy and terms links', () => {
    for (const [key, b] of Object.entries(SMS_CONSENT)) {
        for (const f of ['legalName', 'address', 'website', 'phone', 'sample', 'privacyUrl', 'termsUrl']) assert.ok(b[f], `${key}.${f}`);
        assert.match(b.sample, /Reply STOP to opt out\.$/, key);
        assert.match(b.privacyUrl, /^https:\/\//);
        assert.match(b.termsUrl, /^https:\/\//);
    }
    assert.match(CONSENT_LINE, /Message and data rates may apply/);
    assert.match(CONSENT_LINE, /STOP/);
});

test('Ari tells phone callers about the confirmation text (the line the registrations quote); web chat does not', () => {
    const sub = { name: 'Test Co', business_info: 'x', instructions: 'y' };
    assert.ok(buildSystemPrompt(sub, 'phone').includes(CONSENT_LINE));
    assert.ok(!buildSystemPrompt(sub, 'web').includes(CONSENT_LINE));
});
