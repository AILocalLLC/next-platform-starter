import { randomBytes, timingSafeEqual } from 'node:crypto';
import { runTurn } from 'lib/receptionist';
import { bookingContext } from 'lib/booking';
import { upsertLead } from 'lib/leads';
import { createAdminClient } from 'lib/supabase/admin';
import { finalizeCall } from 'lib/voice';

export const maxDuration = 26;

const MAX_MESSAGE = 1000;
const MAX_TURNS = 30;
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

const json = (body, status = 200) => Response.json(body, { status, headers: CORS });

function tokenMatches(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}

async function loadSubaccount(db, id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data } = await db.from('subaccounts').select('*').eq('id', id).maybeSingle();
    return data?.chat_enabled ? data : null;
}

export function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS });
}

// Widget config: name + greeting.
export async function GET(request, { params }) {
    const { subaccountId } = await params;
    const sub = await loadSubaccount(createAdminClient(), subaccountId);
    if (!sub) return json({ error: 'Chat is not enabled.' }, 404);
    return json({ name: sub.name, greeting: sub.chat_greeting });
}

// Body: { message, sessionId?, token? }  ->  { reply, sessionId, token }
export async function POST(request, { params }) {
    const { subaccountId } = await params;
    const db = createAdminClient();
    const sub = await loadSubaccount(db, subaccountId);
    if (!sub) return json({ error: 'Chat is not enabled.' }, 404);

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Invalid JSON.' }, 400);
    }
    const message = String(body.message || '').trim();
    if (!message) return json({ error: 'Message is required.' }, 400);
    if (message.length > MAX_MESSAGE) return json({ error: 'Message is too long.' }, 400);

    let chat;
    if (body.sessionId) {
        const { data } = await db.from('calls').select('*').eq('id', body.sessionId).eq('subaccount_id', sub.id).eq('channel', 'web').maybeSingle();
        if (!data || !tokenMatches(String(body.token || ''), data.chat_token || '')) return json({ error: 'Session not found.' }, 404);
        chat = data;
    } else {
        const { data, error } = await db
            .from('calls')
            .insert({
                subaccount_id: sub.id,
                channel: 'web',
                status: 'in-progress',
                chat_token: randomBytes(24).toString('hex'),
                transcript: [{ role: 'ai', text: sub.chat_greeting, at: new Date().toISOString() }]
            })
            .select('*')
            .single();
        if (error) return json({ error: 'Could not start chat.' }, 500);
        chat = data;
    }

    if (chat.transcript.filter((t) => t.role === 'caller').length >= MAX_TURNS) {
        return json({ reply: 'Thanks for chatting! Someone from our team will follow up with you.', sessionId: chat.id, token: chat.chat_token, done: true });
    }

    const transcript = [...chat.transcript, { role: 'caller', text: message, at: new Date().toISOString() }];
    const callerText = chat.messages.length
        ? message
        : `[Website chat started ${new Date().toLocaleString('en-US', { timeZone: sub.timezone || 'America/New_York' })}. Page: ${String(body.page || 'unknown').slice(0, 200)}]\nYou already greeted the visitor with: "${sub.chat_greeting}"\nVisitor: ${message}`;

    const state = { contactId: chat.contact_id };
    const onSaveLead = async (lead) => {
        if (!lead.phone && !lead.email) throw new Error('Ask for a phone number or email first.');
        state.contactId = await upsertLead(db, { subaccountId: sub.id, contactId: state.contactId, lead, source: 'website_chat' });
    };
    const booking = bookingContext({ db, subaccount: sub, callId: chat.id, fallbackPhone: null, source: 'website_chat', state });

    let result;
    try {
        result = await runTurn({ ...booking, messages: chat.messages, callerText, onSaveLead, channel: 'web' });
    } catch (err) {
        console.error('chat turn failed', err);
        return json({ error: 'Sorry, something went wrong. Please try again.' }, 502);
    }

    const reply = result.reply || 'Sorry, could you say that again?';
    transcript.push({ role: 'ai', text: reply, at: new Date().toISOString() });
    const contactId = state.contactId;
    const firstLead = contactId && !chat.lead_captured;
    await db
        .from('calls')
        .update({ messages: result.messages, transcript, contact_id: contactId, lead_captured: Boolean(contactId), ended_at: new Date().toISOString() })
        .eq('id', chat.id);

    // Chats have no hang-up event, so summarize and notify as soon as a lead is captured.
    if (firstLead) await finalizeCall(chat.id, { status: 'completed' });

    return json({ reply, sessionId: chat.id, token: chat.chat_token });
}
