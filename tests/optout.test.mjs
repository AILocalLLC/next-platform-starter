import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyOptOutKeyword, customerTextTo, isOptedOut, optOutKeyword } from '../lib/optOut.js';

// Just enough of the Supabase client for sms_opt_outs.
function fakeDb({ rows = [], error = null } = {}) {
    const db = { rows, calls: [] };
    const where = (filters) => (r) => filters.every(([k, v]) => r[k] === v);
    db.from = (table) => {
        db.calls.push(table);
        return {
            select() {
                const filters = [];
                const q = {
                    eq: (k, v) => (filters.push([k, v]), q),
                    limit: () => q,
                    maybeSingle: async () => (error ? { data: null, error } : { data: db.rows.find(where(filters)) || null, error: null })
                };
                return q;
            },
            async upsert(row) {
                if (error) return { error };
                if (!db.rows.some(where([['subaccount_id', row.subaccount_id], ['phone', row.phone]]))) db.rows.push(row);
                return { error: null };
            },
            delete() {
                const filters = [];
                const q = {
                    eq: (k, v) => (filters.push([k, v]), q),
                    then: (resolve) => {
                        db.rows = db.rows.filter((r) => !where(filters)(r));
                        resolve({ error });
                    }
                };
                return q;
            }
        };
    };
    return db;
}

test('keywords: whole message, any case, trimmed', () => {
    for (const w of ['STOP', 'stop', ' Stop ', 'STOPALL', 'unsubscribe', 'Cancel', 'END', 'quit\n']) assert.equal(optOutKeyword(w), 'stop', w);
    for (const w of ['START', 'unstop', 'Yes']) assert.equal(optOutKeyword(w), 'start', w);
    for (const w of ['stop calling me after 5', 'please stop', 'yes please', 'STOP!', '', null, 'Hello']) assert.equal(optOutKeyword(w), null, String(w));
});

test('STOP records the opt-out for that business only; START clears it', async () => {
    const db = fakeDb();
    assert.equal(await applyOptOutKeyword(db, 's1', '+13305550101', 'Stop'), 'stop');
    assert.equal(await applyOptOutKeyword(db, 's1', '+13305550101', 'STOP'), 'stop', 'twice is fine');
    assert.equal(db.rows.length, 1);
    assert.equal(await isOptedOut(db, 's1', '+13305550101'), true);
    assert.equal(await isOptedOut(db, 's2', '+13305550101'), false, 'another business');
    assert.equal(await applyOptOutKeyword(db, 's1', '+13305550101', 'start'), 'start');
    assert.equal(await isOptedOut(db, 's1', '+13305550101'), false);
});

test('ordinary texts do not touch the opt-out list', async () => {
    const db = fakeDb();
    assert.equal(await applyOptOutKeyword(db, 's1', '+13305550101', 'Can you come Tuesday?'), null);
    assert.deepEqual(db.calls, []);
});

test('customerTextTo: skips opted-out and non-US numbers, else gives the +1 number', async () => {
    const db = fakeDb({ rows: [{ subaccount_id: 's1', phone: '+13305550101' }] });
    assert.deepEqual(await customerTextTo(db, 's1', '(330) 555-0101'), { skipped: 'opted_out' });
    assert.deepEqual(await customerTextTo(db, 's1', '330-555-0102'), { to: '+13305550102' });
    assert.deepEqual(await customerTextTo(db, 's2', '+13305550101'), { to: '+13305550101' });
    const warn = console.warn;
    console.warn = () => {};
    try {
        assert.deepEqual(await customerTextTo(db, 's1', '+447911123456'), { skipped: 'not_us' });
    } finally {
        console.warn = warn;
    }
});

test('opt-out check: missing table (migration not applied) allows, other errors block', async () => {
    assert.equal(await isOptedOut(fakeDb({ error: { code: 'PGRST205', message: 'no table' } }), 's1', '+13305550101'), false);
    await assert.rejects(isOptedOut(fakeDb({ error: { code: '57014', message: 'timeout' } }), 's1', '+13305550101'), /opt-out check failed/);
    await assert.rejects(customerTextTo(fakeDb({ error: { code: '57014', message: 'timeout' } }), 's1', '+13305550101'));
});
