import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toUsE164, toE164 } from '../lib/phone.js';
import { createLimiter, visitorIp } from '../lib/chatLimits.js';

test('toUsE164 accepts US numbers only', () => {
    assert.equal(toUsE164('(330) 555-1212'), '+13305551212');
    assert.equal(toUsE164('+1 330 555 1212'), '+13305551212');
    assert.equal(toUsE164('+447911123456'), null);
    assert.equal(toUsE164('+1900'), null);
    assert.equal(toUsE164('+11305551212'), null); // area code can't start with 1
    assert.equal(toUsE164(''), null);
    assert.equal(toE164('+447911123456'), '+447911123456'); // general helper unchanged
});

test('limiter allows up to the limit inside the window, then again after it', () => {
    let t = 0;
    const hit = createLimiter({ now: () => t });
    assert.equal(hit('a', 2, 1000), true);
    assert.equal(hit('a', 2, 1000), true);
    assert.equal(hit('a', 2, 1000), false);
    assert.equal(hit('b', 2, 1000), true);
    t = 1001;
    assert.equal(hit('a', 2, 1000), true);
});

test('visitorIp prefers the Netlify header the visitor cannot set', () => {
    const h = (o) => new Headers(o);
    assert.equal(visitorIp(h({ 'x-nf-client-connection-ip': '5.5.5.5', 'x-forwarded-for': '1.1.1.1' })), '5.5.5.5');
    assert.equal(visitorIp(h({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })), '1.1.1.1');
    assert.equal(visitorIp(h({})), 'unknown');
});
