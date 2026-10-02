import twilio from 'twilio';
import { createAdminClient } from './supabase/admin';
import { slotLabel } from './gcal';
import { confirmationText } from './leads';
import { summarizeCall } from './receptionist';

export const VOICE = process.env.TWILIO_VOICE || 'Polly.Joanna-Neural';

export function publicUrl(request) {
    const url = new URL(request.url);
    const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
    return base ? `${base}${url.pathname}${url.search}` : url.toString();
}

// Parse Twilio's form POST and verify its signature. Returns params or null if invalid.
export async function readTwilioRequest(request) {
    const form = await request.formData();
    const params = Object.fromEntries(form.entries());
    if (process.env.TWILIO_SKIP_VALIDATION === '1') return params;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const signature = request.headers.get('x-twilio-signature') || '';
    if (!token || !twilio.validateRequest(token, signature, publicUrl(request), params)) return null;
    return params;
}

export function twimlResponse(twiml) {
    return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
}

export function forbidden() {
    return new Response('Forbidden', { status: 403 });
}

export function gather(twiml, callId, text, attempt = 0) {
    const g = twiml.gather({
        input: 'speech',
        // A fixed 1s pause ends the caller's turn; 'auto' often waits several seconds.
        speechTimeout: '1',
        speechModel: 'phone_call',
        language: 'en-US',
        action: `/api/voice/turn?call=${callId}`,
        method: 'POST'
    });
    if (text) g.say({ voice: VOICE }, text);
    // No speech: Twilio falls through to this redirect.
    twiml.redirect({ method: 'POST' }, `/api/voice/turn?call=${callId}&silent=${attempt + 1}`);
}

// Idempotent: summarize, and text the owner if a lead was captured. Safe to call more than once.
export async function finalizeCall(callId, { status, duration } = {}) {
    const db = createAdminClient();
    const { data: call } = await db.from('calls').select('*, subaccounts(*)').eq('id', callId).maybeSingle();
    if (!call) return;

    const patch = { status: status || 'completed', ended_at: call.ended_at || new Date().toISOString() };
    if (duration != null) patch.duration_seconds = Number(duration);
    await db.from('calls').update(patch).eq('id', callId);
    if (call.summary) return;

    const subaccount = call.subaccounts;
    let summary;
    try {
        summary = await summarizeCall({ subaccount, transcript: call.transcript });
    } catch (err) {
        console.error('summarize failed', err);
        summary = 'Summary unavailable.';
    }
    // Only the first finalizer to set the summary sends the notification.
    const { data: claimed } = await db.from('calls').update({ summary }).eq('id', callId).is('summary', null).select('id');
    if (!claimed?.length) return;

    if (!call.lead_captured || !subaccount.twilio_number || !process.env.TWILIO_ACCOUNT_SID) return;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Confirmation text to the customer (phone calls only; chats have no verified number).
    if (call.channel !== 'web' && call.contact_id) {
        const { data: contact } = await db.from('contacts').select('name, phone').eq('id', call.contact_id).maybeSingle();
        if (contact?.phone) {
            try {
                const { data: appt } = await db.from('appointments').select('start_at').eq('call_id', call.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                const label = appt ? slotLabel(appt.start_at, subaccount.timezone || 'America/New_York') : null;
                await client.messages.create({ from: subaccount.twilio_number, to: contact.phone, body: confirmationText(subaccount, contact, label) });
            } catch (err) {
                console.error('caller SMS failed', err);
            }
        }
    }

    if (subaccount.notify_phone) {
        try {
            await client.messages.create({
                from: subaccount.twilio_number,
                to: subaccount.notify_phone,
                body: `New lead from ${call.channel === 'web' ? 'website chat' : call.from_number || 'unknown'}: ${summary}`.slice(0, 1500)
            });
        } catch (err) {
            console.error('owner SMS failed', err);
        }
    }
}
