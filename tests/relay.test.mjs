import assert from 'node:assert/strict';
import { test } from 'node:test';
import twilio from 'twilio';
import { relaySig, relaySigOk, relayTwiml, usesRelay } from '../lib/relay.js';
import { voiceTurn } from '../lib/voiceTurn.js';

process.env.TWILIO_AUTH_TOKEN = 't'.repeat(32);

test('call signature: only the matching call id and key pass', () => {
    const sig = relaySig('call-1');
    assert.match(sig, /^[0-9a-f]{64}$/);
    assert.equal(relaySigOk('call-1', sig), true);
    assert.equal(relaySigOk('call-2', sig), false);
    assert.equal(relaySigOk('call-1', 'f'.repeat(64)), false);
    assert.equal(relaySigOk('call-1', undefined), false);
    assert.equal(relaySigOk('call-1', sig, 'other-key'), false);
});

test('only businesses set to relay use it', () => {
    assert.equal(usesRelay({ voice_engine: 'relay' }), true);
    assert.equal(usesRelay({ voice_engine: 'gather' }), false);
    assert.equal(usesRelay({}), false);
});

test('TwiML: same Joanna voice, greeting, signed bridge URL, hand-off to relay-done', () => {
    const twiml = new twilio.twiml.VoiceResponse();
    relayTwiml(twiml, { callId: 'call-1', greeting: 'Hi, call 330-555-1212.' });
    const xml = twiml.toString();
    assert.match(xml, /<Connect action="\/api\/voice\/relay-done\?call=call-1" method="POST">/);
    assert.match(xml, /ttsProvider="Amazon"/);
    assert.match(xml, /voice="Joanna-Neural"/);
    assert.match(xml, /transcriptionProvider="Deepgram" speechModel="flux-general-en"/);
    assert.doesNotMatch(xml, /ignorebackchannel|backgroundnoisereduction|speechtimeout/, 'attributes Twilio rejects');
    assert.match(xml, new RegExp(`url="wss://api-596595914790\\.us-central1\\.run\\.app/api/v1/voice-relay\\?call=call-1&amp;sig=${relaySig('call-1')}"`));
    assert.match(xml, /welcomeGreeting="Hi, call 3 3 0, 5 5 5, 1 2 1 2\."/, 'phone numbers read digit by digit, as with <Say>');
});

function fakeDb() {
    const updates = [];
    return {
        updates,
        from: () => ({ update: (row) => ({ eq: async () => (updates.push(row), { error: null }) }) })
    };
}
const sub = { id: 's1', name: 'AI Local', greeting: 'Hello, this is Ari.', timezone: 'America/New_York', transfer_number: null, calendar_id: null };
const callRow = (extra = {}) => ({ id: 'call-1', from_number: '+13305550101', started_at: new Date().toISOString(), contact_id: null, messages: [], transcript: [{ role: 'ai', text: sub.greeting }], subaccounts: sub, ...extra });

test('a caller turn: the reply is returned and the transcript saved, the same for both engines', async () => {
    const db = fakeDb();
    let asked;
    const run = async (args) => ((asked = args), { messages: [{ role: 'user', content: 'x' }], reply: 'Sure, what is your name?', action: 'continue', timing: { ai: 500 } });
    const r = await voiceTurn({ db, call: callRow(), speech: ' I need a website ', run });
    assert.deepEqual([r.reply, r.action], ['Sure, what is your name?', 'continue']);
    assert.match(asked.callerText, /You already greeted the caller with: "Hello, this is Ari\."\nCaller: I need a website$/);
    const saved = db.updates[0];
    assert.deepEqual(saved.transcript.slice(1).map((t) => [t.role, t.text]), [['caller', 'I need a website'], ['ai', 'Sure, what is your name?']]);
    assert.equal(saved.transcript[2].timing.ai, 500);
});

test('silence: asks once, then says goodbye; nothing is saved', async () => {
    const db = fakeDb();
    const run = async () => assert.fail('no AI call on silence');
    const first = await voiceTurn({ db, call: callRow(), speech: '', silent: 1, run });
    assert.deepEqual([first.reply, first.action, first.silent], ['Are you still there?', 'continue', true]);
    const second = await voiceTurn({ db, call: callRow(), speech: '', silent: 2, run });
    assert.equal(second.action, 'hangup');
    assert.match(second.reply, /^I didn't hear anything/);
    assert.equal(db.updates.length, 0);
});

test('AI failure never drops the caller: voicemail, or transfer when there is a number', async () => {
    const run = async () => { throw new Error('overloaded'); };
    const a = await voiceTurn({ db: fakeDb(), call: callRow(), speech: 'hello', run });
    assert.equal(a.action, 'voicemail');
    const b = await voiceTurn({ db: fakeDb(), call: callRow({ subaccounts: { ...sub, transfer_number: '+13304884225' } }), speech: 'hello', run });
    assert.equal(b.action, 'transfer');
});
