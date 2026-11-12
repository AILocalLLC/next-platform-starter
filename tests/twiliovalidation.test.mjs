import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skipTwilioValidation } from '../lib/voice.js';

const base = { TWILIO_SKIP_VALIDATION: '1' };

test('skip flag works only for local, non-production runs', () => {
    assert.equal(skipTwilioValidation({ ...base, NODE_ENV: 'development' }), true);
    assert.equal(skipTwilioValidation({ ...base, PUBLIC_BASE_URL: 'http://localhost:3000' }), true);
});

test('skip flag is ignored in production', () => {
    assert.equal(skipTwilioValidation({ ...base, NODE_ENV: 'production' }), false);
    assert.equal(skipTwilioValidation({ ...base, CONTEXT: 'production' }), false);
    assert.equal(skipTwilioValidation({ ...base, NODE_ENV: 'development', CONTEXT: 'production' }), false);
    assert.equal(skipTwilioValidation({ ...base, NODE_ENV: 'production', CONTEXT: 'deploy-preview' }), false);
});

test('skip flag is ignored on a real https address or when not set to 1', () => {
    assert.equal(skipTwilioValidation({ ...base, PUBLIC_BASE_URL: 'https://example.com' }), false);
    assert.equal(skipTwilioValidation({ TWILIO_SKIP_VALIDATION: 'true' }), false);
    assert.equal(skipTwilioValidation({}), false);
});
