import assert from 'node:assert/strict';
import { test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildTools, runTurn } from '../lib/receptionist.js';
import { dailyCounts, summarize, formatPhone } from '../lib/stats.js';
import { toE164 } from '../lib/phone.js';

const sub = { name: 'Acme Gutters', business_info: 'We install gutters.', instructions: 'Ask for address.', transfer_number: null };

function fakeClient(responses) {
    const calls = [];
    return {
        calls,
        beta: { messages: { create: async (req) => (calls.push(structuredClone(req)), responses.shift()) } }
    };
}

test('system prompt includes business info and no transfer tool without number', () => {
    assert.match(buildSystemPrompt(sub), /We install gutters/);
    assert.match(buildSystemPrompt(sub), /Ask for address/);
    assert.deepEqual(buildTools(sub).map((t) => t.name), ['save_lead', 'end_call']);
    assert.deepEqual(buildTools({ ...sub, transfer_number: '+15551234567' }).map((t) => t.name), ['save_lead', 'end_call', 'transfer_call']);
});

test('plain reply continues the call', async () => {
    const client = fakeClient([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sure, what is your name?' }] }]);
    const r = await runTurn({ subaccount: sub, messages: [], callerText: 'I need gutters', onSaveLead: async () => {}, client });
    assert.equal(r.action, 'continue');
    assert.equal(r.reply, 'Sure, what is your name?');
    assert.equal(r.messages.length, 2);
    const req = client.calls[0];
    assert.equal(req.model, 'claude-sonnet-5'); // phone: low-latency model
    assert.equal('fallbacks' in req, false);
    assert.equal('betas' in req, false);
});

test('save_lead runs the tool and loops for the spoken reply', async () => {
    const saved = [];
    const client = fakeClient([
        { stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'tool_use', id: 't1', name: 'save_lead', input: { name: 'Bob', reason: 'Quote' } }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Got it Bob, we will call you.' }] }
    ]);
    const r = await runTurn({ subaccount: sub, messages: [], callerText: "I'm Bob, want a quote", onSaveLead: async (l) => saved.push(l), client });
    assert.deepEqual(saved, [{ name: 'Bob', reason: 'Quote' }]);
    assert.equal(r.reply, 'Got it Bob, we will call you.');
    assert.equal(r.action, 'continue');
    // user, assistant(tool_use), user(tool_result), assistant(text)
    assert.deepEqual(r.messages.map((m) => m.role), ['user', 'assistant', 'user', 'assistant']);
    assert.equal(r.messages[2].content[0].tool_use_id, 't1');
    // Second request replays the thinking block unchanged (append-only history).
    assert.equal(client.calls[1].messages[1].content[0].type, 'thinking');
});

test('save_lead failure is reported to the model as an error result', async () => {
    const client = fakeClient([
        { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'save_lead', input: { name: 'Bob', reason: 'x' } }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Someone will follow up.' }] }
    ]);
    const r = await runTurn({ subaccount: sub, messages: [], callerText: 'hi', onSaveLead: async () => { throw new Error('db down'); }, client });
    assert.equal(r.messages[2].content[0].is_error, true);
    assert.equal(r.reply, 'Someone will follow up.');
});

test('end_call hangs up with the goodbye text', async () => {
    const client = fakeClient([{ stop_reason: 'tool_use', content: [{ type: 'text', text: 'Bye now!' }, { type: 'tool_use', id: 't2', name: 'end_call', input: {} }] }]);
    const r = await runTurn({ subaccount: sub, messages: [], callerText: 'bye', onSaveLead: async () => {}, client });
    assert.equal(r.action, 'hangup');
    assert.equal(r.reply, 'Bye now!');
    assert.equal(client.calls.length, 1);
});

test('transfer_call is ignored without a transfer number', async () => {
    const client = fakeClient([
        { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't3', name: 'transfer_call', input: {} }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'I can take a message.' }] }
    ]);
    const r = await runTurn({ subaccount: sub, messages: [], callerText: 'human please', onSaveLead: async () => {}, client });
    assert.equal(r.action, 'continue');
    assert.equal(r.messages[2].content[0].is_error, true);
});

test('refusal gives a safe spoken fallback', async () => {
    const client = fakeClient([{ stop_reason: 'refusal', content: [] }]);
    const r = await runTurn({ subaccount: sub, messages: [], callerText: 'x', onSaveLead: async () => {}, client });
    assert.match(r.reply, /follow up/);
});

test('stats helpers', () => {
    const now = new Date('2026-09-28T18:00:00Z');
    const d = dailyCounts([{ started_at: '2026-09-28T15:00:00Z', lead_captured: true }, { started_at: '2026-09-27T15:00:00Z' }, { started_at: '2025-01-01T00:00:00Z' }], 7, 'America/Chicago', now);
    assert.equal(d.length, 7);
    assert.deepEqual(d.at(-1), { date: '2026-09-28', calls: 1, leads: 1 });
    assert.equal(d.at(-2).calls, 1);
    assert.deepEqual(summarize([{ lead_captured: true, duration_seconds: 90 }, { duration_seconds: 30 }]), { total: 2, leads: 1, conversion: 50, minutes: 2 });
    assert.equal(formatPhone('+19185551234'), '(918) 555-1234');
    assert.equal(toE164('(918) 555-1234'), '+19185551234');
    assert.equal(toE164('1-918-555-1234'), '+19185551234');
});

test('website chat keeps Opus with refusal fallback', async () => {
    const client = fakeClient([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hi!' }] }]);
    await runTurn({ subaccount: sub, messages: [], callerText: 'hi', onSaveLead: async () => {}, channel: 'web', client });
    assert.equal(client.calls[0].model, 'claude-opus-5');
    assert.equal(client.calls[0].fallbacks, 'default');
    assert.deepEqual(client.calls[0].betas, ['server-side-fallback-2026-07-01']);
});

test('phone call retries on the main model if the fast model rejects the request', async () => {
    const calls = [];
    const client = {
        beta: {
            messages: {
                create: async (req) => {
                    calls.push(req.model);
                    if (req.model === 'claude-sonnet-5') throw new Anthropic.BadRequestError(400, { error: { message: 'bad' } }, 'bad', new Headers());
                    return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hello!' }] };
                }
            }
        }
    };
    const r = await runTurn({ subaccount: sub, messages: [], callerText: 'hi', onSaveLead: async () => {}, client });
    assert.deepEqual(calls, ['claude-sonnet-5', 'claude-opus-5']);
    assert.equal(r.reply, 'Hello!');
});

test('calendar tool with spoken text pauses, then resumes and finishes', async () => {
    const calSub = { ...sub, calendar_enabled: true };
    const calendar = { findSlots: async () => [{ start: '2026-10-05T13:00:00.000Z', label: 'Monday 9:00 AM' }] };
    const client = fakeClient([
        { stop_reason: 'tool_use', content: [{ type: 'text', text: 'Let me check.' }, { type: 'tool_use', id: 'c1', name: 'check_availability', input: {} }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'I have Monday at 9.' }] }
    ]);
    const first = await runTurn({ subaccount: calSub, messages: [], callerText: 'book me', onSaveLead: async () => {}, calendar, yieldBeforeTools: true, client });
    assert.equal(first.action, 'pending');
    assert.equal(first.reply, 'Let me check.');
    assert.equal(client.calls.length, 1);

    const second = await runTurn({ subaccount: calSub, messages: first.messages, callerText: null, onSaveLead: async () => {}, calendar, client });
    assert.equal(second.action, 'continue');
    assert.equal(second.reply, 'I have Monday at 9.');
    assert.equal(second.messages.at(-2).content[0].tool_use_id, 'c1');
    assert.match(second.messages.at(-2).content[0].content, /Monday 9:00 AM/);
});

test('save_lead never pauses, so the next caller words are not missed', async () => {
    const client = fakeClient([
        { stop_reason: 'tool_use', content: [{ type: 'text', text: 'Thanks Bob.' }, { type: 'tool_use', id: 's1', name: 'save_lead', input: { name: 'Bob', reason: 'Quote' } }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'What is your address?' }] }
    ]);
    const r = await runTurn({ subaccount: sub, messages: [], callerText: "I'm Bob", onSaveLead: async () => {}, yieldBeforeTools: true, client });
    assert.equal(r.action, 'continue');
    assert.equal(r.reply, 'Thanks Bob. What is your address?');
});

test('silent calendar call still speaks a filler line first', async () => {
    const client = fakeClient([{ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'b1', name: 'book_appointment', input: { start: 'x', name: 'Bob', reason: 'Quote' } }] }]);
    const r = await runTurn({ subaccount: { ...sub, calendar_enabled: true }, messages: [], callerText: '10 works', onSaveLead: async () => {}, calendar: {}, yieldBeforeTools: true, client });
    assert.equal(r.action, 'pending');
    assert.equal(r.reply, 'One moment while I book that.');
});
