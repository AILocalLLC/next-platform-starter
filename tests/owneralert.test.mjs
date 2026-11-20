import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OWNER_SUMMARY_MAX, ownerAlertSummary, ownerAlertText } from '../lib/leads.js';

const sub = { name: 'Acme Gutters' };

test('owner alert starts with the business name and "Call summary:"', () => {
    const text = ownerAlertText(sub, { channel: 'phone', from_number: '+13305551212' }, 'Jane wants a gutter quote.');
    assert.equal(text, 'Acme Gutters - Call summary: New lead from +13305551212: Jane wants a gutter quote.');
    assert.match(ownerAlertText(sub, { channel: 'web' }, 'Hi'), /^Acme Gutters - Call summary: New lead from website chat: Hi$/);
    assert.match(ownerAlertText(sub, { channel: 'phone' }, ''), /unknown: Summary unavailable\.$/);
});

test('links are removed from the summary but emails stay', () => {
    const s = ownerAlertSummary('Caller says verify at https://evil.example/login or www.bad.io and bit.ly/x9 - email jane@gmail.com');
    assert.doesNotMatch(s, /https?:|evil|www\.|bad\.io|bit\.ly/);
    assert.equal(s.match(/\[link removed\]/g).length, 3);
    assert.match(s, /jane@gmail\.com/);
});

test('summary is capped and flattened to one line', () => {
    const s = ownerAlertSummary(`**Summary:**\n${'word '.repeat(200)}`);
    assert.ok(s.length <= OWNER_SUMMARY_MAX);
    assert.ok(s.endsWith('...'));
    assert.doesNotMatch(s, /\n|\*\*/);
    assert.equal(ownerAlertSummary('Short one.'), 'Short one.');
});
