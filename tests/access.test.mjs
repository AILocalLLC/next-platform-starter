import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarAllowed } from '../lib/gcal.js';
import { fromIsBusiness } from '../lib/phone.js';

const sub = { calendar_id: 'Owner@Plumber.com', twilio_number: '+13305550100' };

test('calendar: only the business calendar or one on AGENCY_CALENDARS', () => {
    const env = { AGENCY_CALENDARS: ' ted@ailocal.net, Sales@AiLocal.net ,' };
    assert.equal(calendarAllowed(sub, 'owner@plumber.com', {}), true, 'case-insensitive');
    assert.equal(calendarAllowed(sub, ' OWNER@plumber.com ', {}), true);
    assert.equal(calendarAllowed(sub, 'ted@ailocal.net', env), true);
    assert.equal(calendarAllowed(sub, 'sales@ailocal.net', env), true);
    assert.equal(calendarAllowed(sub, 'ted@ailocal.net', {}), false, 'empty list by default');
    assert.equal(calendarAllowed(sub, 'owner@other-client.com', env), false, "another client's calendar");
    assert.equal(calendarAllowed(sub, '', env), false, 'blank entries never match');
    assert.equal(calendarAllowed({ calendar_id: null }, 'owner@plumber.com', {}), false);
});

test('sms send: the from number must be the business number', () => {
    assert.equal(fromIsBusiness(sub, undefined), true, 'found by slug, no from');
    assert.equal(fromIsBusiness(sub, '+13305550100'), true);
    assert.equal(fromIsBusiness(sub, '(330) 555-0100'), true);
    assert.equal(fromIsBusiness(sub, '+13305550199'), false, "another business's number");
    assert.equal(fromIsBusiness({ twilio_number: null }, '+13305550100'), false);
});
