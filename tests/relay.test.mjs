import assert from 'node:assert/strict';
import { test } from 'node:test';
import twilio from 'twilio';
import { RELAY_SAY_VOICE, relaySig, relaySigOk, relaySpeakable, relayTwiml, relayVoiceFor, usesRelay } from '../lib/relay.js';
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

test('TwiML: same voice as <Say>, greeting, signed bridge URL, hand-off to relay-done', () => {
    const twiml = new twilio.twiml.VoiceResponse();
    relayTwiml(twiml, { callId: 'call-1', greeting: 'Hi, A.I. Local here, call 330-555-1212.' });
    const xml = twiml.toString();
    assert.match(xml, /<Connect action="\/api\/voice\/relay-done\?call=call-1" method="POST">/);
    // No TWILIO_VOICE in tests: the default Polly.Joanna-Neural.
    assert.match(xml, /ttsProvider="Amazon"/);
    assert.match(xml, /voice="Joanna-Neural"/);
    assert.match(xml, /partialPrompts="true"/);
    assert.match(xml, /transcriptionProvider="Deepgram" speechModel="flux-general-en"/);
    assert.doesNotMatch(xml, /ignorebackchannel|backgroundnoisereduction|speechtimeout/, 'attributes Twilio rejects');
    assert.match(xml, new RegExp(`url="wss://api-596595914790\\.us-central1\\.run\\.app/api/v1/voice-relay\\?call=call-1&amp;sig=${relaySig('call-1')}"`));
    assert.match(xml, /welcomeGreeting="Hi, AI Local here, call 3 3 0, 5 5 5, 1 2 1 2\."/, 'phone numbers read digit by digit, as with <Say>');
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

test('"A.I." is read as one word (no full-stop pause); hand-off lines use the same voice', () => {
    assert.equal(relaySpeakable("You've reached A.I. Local, where we use AI."), "You've reached AI Local, where we use AI.");
    assert.equal(relaySpeakable('Thanks for calling A.I.'), 'Thanks for calling AI');
    assert.equal(RELAY_SAY_VOICE, 'Polly.Joanna-Neural');
    assert.deepEqual(relayVoiceFor('Google.en-US-Chirp3-HD-Leda'), { provider: 'Google', voice: 'en-US-Chirp3-HD-Leda' });
    assert.deepEqual(relayVoiceFor('Polly.Joanna-Neural'), { provider: 'Amazon', voice: 'Joanna-Neural' });
});

// Fake Claude client whose stream() emits the text in small pieces, like the real API.
function streamingClient(responses) {
    return {
        beta: {
            messages: {
                create: async () => responses.shift(),
                stream: () => {
                    const msg = responses.shift();
                    const handlers = [];
                    return {
                        on: (ev, cb) => ev === 'text' && handlers.push(cb),
                        finalMessage: async () => {
                            const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
                            for (let i = 0; i < text.length; i += 7) handlers.forEach((h) => h(text.slice(i, i + 7)));
                            return msg;
                        }
                    };
                }
            }
        }
    };
}

test('streaming: each finished sentence is spoken while the reply is written; "let me save" talk stays silent', async () => {
    const { runTurn } = await import('../lib/receptionist.js');
    const said = [];
    const client = streamingClient([
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sure. You have reached A.I. Local, and the Answer plan is $197 a month. Let me save that for you. Would you like a consultation?' }] }
    ]);
    const r = await runTurn({ subaccount: { name: 'AI Local', business_info: 'x', instructions: 'y' }, messages: [], callerText: 'price?', onSaveLead: async () => {}, onText: (s) => said.push(s), client });
    assert.deepEqual(said, ['Sure.', 'You have reached A.I. Local, and the Answer plan is $197 a month.', 'Would you like a consultation?']);
    assert.equal(r.reply, said.join(' '));
});

test('voiceTurn rest: only what was not already streamed; a replacement line is sent whole', async () => {
    const db = fakeDb();
    const streamedRun = async ({ onText }) => {
        onText('Sure.');
        return { messages: [], reply: 'Sure. The Answer plan is $197 a month.', action: 'continue' };
    };
    const a = await voiceTurn({ db, call: callRow(), speech: 'price', run: streamedRun, onText: () => {} });
    assert.equal(a.rest, 'The Answer plan is $197 a month.');
    const allStreamed = async ({ onText }) => (onText('Sure.'), onText('Goodbye!'), { messages: [], reply: 'Sure. Goodbye!', action: 'hangup' });
    assert.equal((await voiceTurn({ db, call: callRow(), speech: 'bye', run: allStreamed, onText: () => {} })).rest, '');
    const failing = async ({ onText }) => {
        onText('Sure.');
        throw new Error('overloaded');
    };
    const c = await voiceTurn({ db, call: callRow(), speech: 'hi', run: failing, onText: () => {} });
    assert.equal(c.action, 'voicemail');
    assert.match(c.rest, /leave your name/);
    const plain = await voiceTurn({ db, call: callRow(), speech: 'hi', run: async () => ({ messages: [], reply: 'Hello.', action: 'continue' }) });
    assert.equal(plain.rest, 'Hello.');
});
