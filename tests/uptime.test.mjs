import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECKS, alertMessage, nextState, probe } from '../lib/uptime.js';

const t0 = new Date('2026-11-16T20:00:00Z');
const at = (min) => new Date(t0.getTime() + min * 60000);

test('one failed check never texts; the second in a row texts once; recovery texts once', () => {
    let s = nextState(undefined, { ok: false, error: 'HTTP 502' }, t0);
    assert.equal(s.text, null);
    s = nextState(s.state, { ok: false, error: 'HTTP 502' }, at(5));
    assert.equal(s.text, 'DOWN (HTTP 502) for about 5 min.');
    s = nextState(s.state, { ok: false, error: 'HTTP 502' }, at(10));
    assert.equal(s.text, null, 'no repeat texts while it stays down');
    s = nextState(s.state, { ok: true }, at(15));
    assert.equal(s.text, 'back up after about 15 min.');
    assert.deepEqual(s.state, { fail_count: 0, failing_since: null, alerted: false, last_error: null });
});

test('a blip that recovers before the alert sends nothing', () => {
    const s = nextState(nextState(undefined, { ok: false, error: 'unreachable' }, t0).state, { ok: true }, at(5));
    assert.equal(s.text, null);
});

test('probe: 200 ok, 5xx and network errors fail', async () => {
    assert.deepEqual(await probe('x', async () => ({ ok: true, status: 200 })), { ok: true });
    assert.deepEqual(await probe('x', async () => ({ ok: false, status: 503 })), { ok: false, error: 'HTTP 503' });
    assert.deepEqual(await probe('x', async () => { throw new TypeError('fetch failed'); }), { ok: false, error: 'unreachable' });
});

test('watches the CRM, its API, Ari and the three websites; message names the service', () => {
    assert.deepEqual(CHECKS.map((c) => c.name), ['CRM', 'CRM API', 'Ari phone system', 'newguttersnearme.com', 'ailocal.net', 'thermalroofing.net']);
    assert.equal(alertMessage('CRM', 'DOWN (HTTP 502) for about 10 min.'), 'AI Local alert: CRM DOWN (HTTP 502) for about 10 min.');
});
