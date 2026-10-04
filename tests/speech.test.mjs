import assert from 'node:assert/strict';
import { test } from 'node:test';
import { speakable } from '../lib/speech.js';

test('zip codes and phone numbers are read digit by digit', () => {
    assert.equal(speakable('450 28th Street Northwest, 44647'), '450 28th Street Northwest, 4 4 6 4 7');
    assert.equal(speakable('I have 330-555-1212.'), 'I have 3 3 0, 5 5 5, 1 2 1 2.');
    assert.equal(speakable('Call 3305551212'), 'Call 3 3 0, 5 5 5, 1 2 1 2');
    assert.equal(speakable('Monday at 10:00 AM'), 'Monday at 10:00 AM');
});
