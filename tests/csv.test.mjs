import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvToContacts, parseCsv } from '../lib/csv.js';
import { buildSystemPrompt, buildTools } from '../lib/receptionist.js';

test('parseCsv handles quotes, commas, newlines, CRLF, BOM', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","he said ""hi""\nbye"\r\n\r\n');
    assert.deepEqual(rows, [['a', 'b'], ['x, y', 'he said "hi"\nbye']]);
});

test('Go High Level export maps to contacts', () => {
    const csv = [
        'Contact Id,First Name,Last Name,Phone,Email,Business Name,Tags,Address,City,State,Postal Code',
        'abc,Bob,Smith,(918) 555-1234,BOB@X.COM,Bob Co,"lead, gutters",1 Main St,Tulsa,OK,74101',
        'def,,,,,,,,,,',
        'ghi,Ann,,+19185550000,,,,,,,'
    ].join('\n');
    const rows = csvToContacts(csv);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], {
        name: 'Bob Smith',
        phone: '+19185551234',
        email: 'bob@x.com',
        tags: ['lead', 'gutters'],
        notes: 'Company: Bob Co\nAddress: 1 Main St, Tulsa, OK, 74101'
    });
    assert.equal(rows[1].name, 'Ann');
    assert.equal(rows[1].notes, null);
});

test('web channel: chat prompt and only save_lead tool', () => {
    const sub = { name: 'Acme', business_info: 'x', transfer_number: '+15550000000', business_phone: '+15551112222' };
    assert.match(buildSystemPrompt(sub, 'web'), /chatting with a visitor/);
    assert.match(buildSystemPrompt(sub, 'web'), /\+15551112222/);
    assert.doesNotMatch(buildSystemPrompt(sub, 'web'), /end_call|transfer_call/);
    assert.deepEqual(buildTools(sub, 'web').map((t) => t.name), ['save_lead']);
});
