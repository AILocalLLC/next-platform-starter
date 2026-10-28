import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forwardText, isMissingTable, mediaUrls, threadsFrom } from '../lib/sms.js';

test('missing messages table is detected from Postgres or PostgREST errors', () => {
    assert.equal(isMissingTable({ code: '42P01' }), true);
    assert.equal(isMissingTable({ code: 'PGRST205' }), true);
    assert.equal(isMissingTable({ code: '23505' }), false);
    assert.equal(isMissingTable(null), false);
});

test('media urls are collected from Twilio params', () => {
    assert.deepEqual(mediaUrls({ NumMedia: '2', MediaUrl0: 'a', MediaUrl1: 'b' }), ['a', 'b']);
    assert.deepEqual(mediaUrls({}), []);
});

test('forwarded text names the sender and notes attachments', () => {
    const sub = { name: 'NGNM' };
    assert.equal(forwardText(sub, { name: 'Bob', phone: '+13305551212', body: 'Hi' }), 'Text to NGNM from Bob (+13305551212): Hi');
    assert.equal(forwardText(sub, { phone: '+1330', body: '', media: ['x'] }), 'Text to NGNM from +1330:  [1 attachment]');
});

test('threads keep the newest message per phone', () => {
    const t = threadsFrom([
        { phone: 'a', body: 'new' },
        { phone: 'b', body: 'only' },
        { phone: 'a', body: 'old' }
    ]);
    assert.deepEqual(t.map((m) => m.body), ['new', 'only']);
});
