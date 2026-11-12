import twilio from 'twilio';
import { createAdminClient } from './supabase/admin.js';
import { slotLabel } from './gcal.js';
import { appointmentEventFromRow, callInboxEvent, crmLeadFromContact, pushAppointmentToCrm, pushInboxEvent, pushLeadToCrm, smsInboxEvent } from './crm.js';
import { cleanSummary, confirmationText, notesWithSummary } from './leads.js';
import { summarizeCall } from './receptionist.js';
import { speakable } from './speech.js';
import { usDestination } from './phone.js';
import { customerTextTo } from './optOut.js';

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
    // Local-test escape hatch only: ignored whenever the app runs on a real https address.
    if (process.env.TWILIO_SKIP_VALIDATION === '1' && !/^https:/i.test(process.env.PUBLIC_BASE_URL || '')) return params;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const signature = request.headers.get('x-twilio-signature') || '';
    if (!token || !twilio.validateRequest(token, signature, publicUrl(request), params)) return null;
    return params;
}

export function say(twiml, text, voice = VOICE) {
    // Nothing to say: the ConversationRelay bridge already spoke the line before handing off.
    if (!String(text || '').trim()) return;
    twiml.say({ voice }, speakable(text));
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
        // phone_call: deepgram_nova-3 heard names/addresses better but cut callers off at mid-sentence pauses.
        speechModel: 'phone_call',
        // Twilio's premium version of phone_call: built for noisy phone audio, so background noise is misheard less.
        enhanced: true,
        language: 'en-US',
        action: `/api/voice/turn?call=${callId}`,
        method: 'POST'
    });
    if (text) g.say({ voice: VOICE }, speakable(text));
    // No speech: Twilio falls through to this redirect.
    twiml.redirect({ method: 'POST' }, `/api/voice/turn?call=${callId}&silent=${attempt + 1}`);
}

// TwiML for what happens after Ari's reply (Gather engine, and ConversationRelay hand-offs).
export function twimlForAction(twiml, call, reply, action, voice = VOICE) {
    // Only dial US/Canada numbers; otherwise take a message instead.
    const transferTo = action === 'transfer' ? usDestination(call.subaccounts?.transfer_number, 'transfer') : null;
    if (action === 'transfer' && !transferTo) action = 'voicemail';
    if (action === 'hangup') {
        say(twiml, reply, voice);
        twiml.hangup();
    } else if (action === 'transfer') {
        say(twiml, reply, voice);
        twiml.dial(transferTo);
    } else if (action === 'voicemail') {
        say(twiml, reply, voice);
        twiml.record({
            maxLength: 120,
            playBeep: true,
            transcribe: true,
            transcribeCallback: `/api/voice/voicemail?call=${call.id}`,
            action: `/api/voice/voicemail?call=${call.id}&done=1`
        });
    } else if (action === 'pending') {
        say(twiml, reply, voice);
        twiml.redirect({ method: 'POST' }, `/api/voice/turn?call=${call.id}&resume=1`);
    } else {
        gather(twiml, call.id, reply);
    }
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
        summary = cleanSummary(await summarizeCall({ subaccount, transcript: call.transcript })) || 'Summary unavailable.';
    } catch (err) {
        console.error('summarize failed', err);
        summary = 'Summary unavailable.';
    }
    // Only the first finalizer to set the summary sends the notification.
    const { data: claimed } = await db.from('calls').update({ summary }).eq('id', callId).is('summary', null).select('id');
    if (!claimed?.length) return;

    if (call.lead_captured && call.contact_id) {
        try {
            const { data: contact } = await db.from('contacts').select('notes').eq('id', call.contact_id).maybeSingle();
            const notes = contact && notesWithSummary(contact.notes, summary);
            if (notes) await db.from('contacts').update({ notes }).eq('id', call.contact_id);
        } catch (err) {
            console.error('contact summary note failed', err);
        }
    }

    // Send the lead into the CRM so every lead lives there. The owner alert below
    // is the only one: the CRM skips its own alert for leads we send.
    if (call.lead_captured && call.contact_id && subaccount.crm_funnel_slug) {
        try {
            const { data: contact } = await db.from('contacts').select('name, phone, email, notes').eq('id', call.contact_id).maybeSingle();
            if (contact) await pushLeadToCrm(crmLeadFromContact(subaccount.crm_funnel_slug, contact, summary, call.channel));
        } catch (err) {
            console.error('CRM lead push failed', err);
        }
    }

    // Copy the call or chat (with its summary) into the CRM Inbox, after the lead so the contact exists.
    {
        let contact = null;
        if (call.contact_id) {
            const { data } = await db.from('contacts').select('name, phone, email, notes').eq('id', call.contact_id).maybeSingle();
            contact = data;
        }
        await pushInboxEvent(callInboxEvent(subaccount, { ...call, ...patch }, contact, summary));
        // Times the AI booked on this call go on the CRM calendar too (the CRM ignores repeats).
        const { data: booked } = await db.from('appointments').select('start_at, end_at, google_event_id, google_calendar_id, crm_assignee_id').eq('call_id', call.id);
        for (const appt of booked || []) {
            if (appt.google_event_id) await pushAppointmentToCrm(appointmentEventFromRow(subaccount, appt, contact, summary));
        }
    }

    if (!call.lead_captured || !subaccount.twilio_number || !process.env.TWILIO_ACCOUNT_SID) return;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Confirmation text to the customer (phone calls only; chats have no verified number).
    if (call.channel !== 'web' && call.contact_id) {
        const { data: contact } = await db.from('contacts').select('name, phone').eq('id', call.contact_id).maybeSingle();
        if (contact?.phone) {
            try {
                // US/Canada numbers only, and never to someone who texted STOP.
                const dest = await customerTextTo(db, subaccount.id, contact.phone, 'confirmation text');
                if (dest.to) {
                    const { data: appt } = await db.from('appointments').select('start_at').eq('call_id', call.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                    const label = appt ? slotLabel(appt.start_at, subaccount.timezone || 'America/New_York') : null;
                    const text = confirmationText(subaccount, contact, label);
                    const sent = await client.messages.create({ from: subaccount.twilio_number, to: dest.to, body: text });
                    await pushInboxEvent(smsInboxEvent(subaccount, { direction: 'out', phone: dest.to, body: text, sid: sent?.sid }));
                }
            } catch (err) {
                console.error('caller SMS failed', err);
            }
        }
    }

    const ownerPhone = usDestination(subaccount.notify_phone, 'owner alert');
    if (ownerPhone) {
        try {
            await client.messages.create({
                from: subaccount.twilio_number,
                to: ownerPhone,
                body: `New lead from ${call.channel === 'web' ? 'website chat' : call.from_number || 'unknown'}: ${summary}`.slice(0, 1500)
            });
        } catch (err) {
            console.error('owner SMS failed', err);
        }
    }
}
