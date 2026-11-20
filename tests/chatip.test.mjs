import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIMITS, hashIp, ipChatsLastHour } from '../lib/chatLimits.js';

function fakeDb(count, error = null) {
    const q = { filters: [] };
    const chain = {
        select: (...a) => ((q.select = a), chain),
        eq: (k, v) => (q.filters.push(['eq', k, v]), chain),
        gte: (k, v) => (q.filters.push(['gte', k, v]), Promise.resolve({ count, error }))
    };
    return { q, from: (t) => ((q.table = t), chain) };
}

test('hashIp is a stable salted sha256 and never the raw IP', () => {
    const h = hashIp('5.5.5.5');
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(h, hashIp('5.5.5.5'));
    assert.notEqual(h, hashIp('5.5.5.6'));
    assert.ok(!h.includes('5.5.5.5'));
    assert.equal(hashIp('unknown'), null);
    assert.equal(hashIp(''), null);
});

test('ipChatsLastHour counts web chats for the hashed IP in the last hour', async () => {
    const db = fakeDb(7);
    const now = new Date('2026-01-01T12:00:00Z');
    assert.equal(await ipChatsLastHour(db, 'abc', now), 7);
    assert.equal(db.q.table, 'calls');
    assert.deepEqual(db.q.filters, [
        ['eq', 'client_ip_hash', 'abc'],
        ['eq', 'channel', 'web'],
        ['gte', 'started_at', '2026-01-01T11:00:00.000Z']
    ]);
});

test('ipChatsLastHour skips unknown IPs and surfaces database errors', async () => {
    assert.equal(await ipChatsLastHour(fakeDb(99), null), 0);
    await assert.rejects(ipChatsLastHour(fakeDb(null, new Error('boom')), 'abc'), /boom/);
});

test('database per-IP limit is 20 new chats an hour', () => {
    assert.equal(LIMITS.ipNewChatsPerHourDb, 20);
});
