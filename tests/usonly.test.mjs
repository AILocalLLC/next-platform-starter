import assert from 'node:assert/strict';
import { test } from 'node:test';
import twilio from 'twilio';
import { usDestination, usPhoneField } from '../lib/phone.js';
import { twimlForAction } from '../lib/voice.js';

function quiet(fn) {
    const warn = console.warn;
    const warned = [];
    console.warn = (...a) => warned.push(a.join(' '));
    try {
        return [fn(), warned];
    } finally {
        console.warn = warn;
    }
}

test('usDestination: US/Canada passes, anything else is skipped with a warning', () => {
    assert.deepEqual(quiet(() => usDestination('(330) 555-1212', 'x')), ['+13305551212', []]);
    assert.deepEqual(quiet(() => usDestination('+1 416 555 1212', 'x')), ['+14165551212', []]);
    const [n, warned] = quiet(() => usDestination('+447911123456', 'transfer'));
    assert.equal(n, null);
    assert.match(warned[0], /^transfer: skipped a non-US\/Canada number$/);
    assert.equal(quiet(() => usDestination('+1 876 555 1212'))[0], null, 'Jamaica shares +1');
    assert.equal(quiet(() => usDestination('+1 809 555 1212'))[0], null, 'Dominican Republic shares +1');
    assert.equal(quiet(() => usDestination('+1 900 555 1212'))[0], null, 'premium rate');
    assert.equal(quiet(() => usDestination('+1 787 555 1212'))[0], '+17875551212', 'Puerto Rico is US');
    assert.deepEqual(quiet(() => usDestination(null)), [null, []], 'blank is quietly nothing');
});

test('usPhoneField: blank clears, US saves in +1 form, other countries are refused', () => {
    assert.deepEqual(usPhoneField('transfer_number', null), { value: null });
    assert.deepEqual(usPhoneField('transfer_number', '330-555-1212'), { value: '+13305551212' });
    assert.deepEqual(usPhoneField('notify_phone', '+44 7911 123456'), { error: 'The alert phone must be a US or Canada number.' });
    assert.deepEqual(usPhoneField('transfer_number', '+882 1234'), { error: 'Transfer number must be a US or Canada number.' });
    assert.deepEqual(usPhoneField('business_phone', '011 44 7911 123456'), { error: 'Business phone must be a US or Canada number.' });
});

const call = (transfer_number) => ({ id: 'call-1', subaccounts: { transfer_number } });

test('transfer dials a US number', () => {
    const twiml = new twilio.twiml.VoiceResponse();
    twimlForAction(twiml, call('+13304884225'), 'Transferring you now.', 'transfer');
    assert.match(twiml.toString(), /<Dial>\+13304884225<\/Dial>/);
});

test('transfer to a non-US number never dials: takes a voicemail instead', () => {
    const twiml = new twilio.twiml.VoiceResponse();
    const [, warned] = quiet(() => twimlForAction(twiml, call('+2348012345678'), 'Transferring you now.', 'transfer'));
    const xml = twiml.toString();
    assert.doesNotMatch(xml, /<Dial/);
    assert.match(xml, /<Record [^>]*action="\/api\/voice\/voicemail\?call=call-1&amp;done=1"/);
    assert.equal(warned.length, 1);
});
