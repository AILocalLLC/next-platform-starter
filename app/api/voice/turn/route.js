import twilio from 'twilio';
import { callStartMessage, pendingToolUses, runTurn } from 'lib/receptionist';
import { bookingContext } from 'lib/booking';
import { upsertLead } from 'lib/leads';
import { createAdminClient } from 'lib/supabase/admin';
import { forbidden, gather, readTwilioRequest, twimlResponse, VOICE } from 'lib/voice';

export const maxDuration = 26;

const FALLBACK = "Sorry, I'm having trouble right now. Someone from the team will call you back shortly. Goodbye!";

export async function POST(request) {
    const params = await readTwilioRequest(request);
    if (!params) return forbidden();
    const t0 = Date.now();

    const search = new URL(request.url).searchParams;
    const callId = search.get('call');
    const silent = Number(search.get('silent') || 0);
    // Second half of a turn that already spoke "let me check..." and now runs its calendar tools.
    const resume = search.get('resume') === '1';
    const db = createAdminClient();
    const twiml = new twilio.twiml.VoiceResponse();

    const { data: call } = await db.from('calls').select('*, subaccounts(*)').eq('id', callId).maybeSingle();
    if (!call || call.twilio_call_sid !== params.CallSid) return forbidden();
    const subaccount = call.subaccounts;
    const loadMs = Date.now() - t0;

    const speech = (params.SpeechResult || '').trim();
    if (resume && !pendingToolUses(call.messages).length) {
        gather(twiml, call.id, '');
        return twimlResponse(twiml);
    }
    if (!speech && !resume) {
        if (silent <= 1) {
            gather(twiml, call.id, 'Are you still there?', silent);
        } else {
            twiml.say({ voice: VOICE }, 'I did not hear anything, so I will let you go. Goodbye!');
            twiml.hangup();
        }
        return twimlResponse(twiml);
    }

    const now = new Date().toISOString();
    const transcript = resume ? [...call.transcript] : [...call.transcript, { role: 'caller', text: speech, at: now }];
    const callerText = resume
        ? null
        : call.messages.length
        ? speech
        : `${callStartMessage({ from: call.from_number, startedAt: call.started_at, timezone: subaccount.timezone })}\n` +
          `You already greeted the caller with: "${subaccount.greeting}"\nCaller: ${speech}`;

    const state = { contactId: call.contact_id };
    const onSaveLead = async (lead) => {
        state.contactId = await upsertLead(db, { subaccountId: subaccount.id, contactId: state.contactId, lead, fallbackPhone: call.from_number, source: 'ai_receptionist' });
    };
    const booking = bookingContext({ db, subaccount, callId: call.id, fallbackPhone: call.from_number, source: 'ai_receptionist', state });

    let result;
    try {
        result = await runTurn({ ...booking, messages: call.messages, callerText, onSaveLead, yieldBeforeTools: !resume });
    } catch (err) {
        console.error('receptionist turn failed', err);
        result = { messages: call.messages, reply: FALLBACK, action: 'hangup' };
    }

    const reply = result.reply || (resume && result.action === 'continue' ? '' : result.action === 'continue' ? 'Sorry, could you say that again?' : 'Goodbye!');
    const timing = { ...result.timing, load: loadMs, total: Date.now() - t0 };
    console.log('voice turn timing', call.id, JSON.stringify(timing));
    if (reply) transcript.push({ role: 'ai', text: reply, at: new Date().toISOString(), timing });
    await db
        .from('calls')
        .update({ messages: result.messages, transcript, contact_id: state.contactId, lead_captured: Boolean(state.contactId) })
        .eq('id', call.id);

    if (result.action === 'hangup') {
        twiml.say({ voice: VOICE }, reply);
        twiml.hangup();
    } else if (result.action === 'transfer') {
        twiml.say({ voice: VOICE }, reply);
        twiml.dial(subaccount.transfer_number);
    } else if (result.action === 'pending') {
        twiml.say({ voice: VOICE }, reply);
        twiml.redirect({ method: 'POST' }, `/api/voice/turn?call=${call.id}&resume=1`);
    } else {
        gather(twiml, call.id, reply);
    }
    return twimlResponse(twiml);
}
