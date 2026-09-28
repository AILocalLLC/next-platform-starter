import twilio from 'twilio';
import { callStartMessage, runTurn } from 'lib/receptionist';
import { createAdminClient } from 'lib/supabase/admin';
import { forbidden, gather, readTwilioRequest, twimlResponse, VOICE } from 'lib/voice';

export const maxDuration = 26;

const FALLBACK = "Sorry, I'm having trouble right now. Someone from the team will call you back shortly. Goodbye!";

export async function POST(request) {
    const params = await readTwilioRequest(request);
    if (!params) return forbidden();

    const search = new URL(request.url).searchParams;
    const callId = search.get('call');
    const silent = Number(search.get('silent') || 0);
    const db = createAdminClient();
    const twiml = new twilio.twiml.VoiceResponse();

    const { data: call } = await db.from('calls').select('*, subaccounts(*)').eq('id', callId).maybeSingle();
    if (!call || call.twilio_call_sid !== params.CallSid) return forbidden();
    const subaccount = call.subaccounts;

    const speech = (params.SpeechResult || '').trim();
    if (!speech) {
        if (silent <= 1) {
            gather(twiml, call.id, 'Are you still there?', silent);
        } else {
            twiml.say({ voice: VOICE }, 'I did not hear anything, so I will let you go. Goodbye!');
            twiml.hangup();
        }
        return twimlResponse(twiml);
    }

    const now = new Date().toISOString();
    const transcript = [...call.transcript, { role: 'caller', text: speech, at: now }];
    const callerText = call.messages.length
        ? speech
        : `${callStartMessage({ from: call.from_number, startedAt: call.started_at, timezone: subaccount.timezone })}\n` +
          `You already greeted the caller with: "${subaccount.greeting}"\nCaller: ${speech}`;

    let contactId = call.contact_id;
    const onSaveLead = async (lead) => {
        const row = {
            subaccount_id: subaccount.id,
            name: lead.name,
            phone: lead.phone || call.from_number,
            email: lead.email || null,
            source: 'ai_receptionist',
            notes: [lead.reason, lead.callback_time && `Preferred time: ${lead.callback_time}`].filter(Boolean).join('\n')
        };
        const res = contactId
            ? await db.from('contacts').update(row).eq('id', contactId).select('id').single()
            : await db.from('contacts').insert(row).select('id').single();
        if (res.error) throw new Error(res.error.message);
        contactId = res.data.id;
    };

    let result;
    try {
        result = await runTurn({ subaccount, messages: call.messages, callerText, onSaveLead });
    } catch (err) {
        console.error('receptionist turn failed', err);
        result = { messages: call.messages, reply: FALLBACK, action: 'hangup' };
    }

    const reply = result.reply || (result.action === 'continue' ? 'Sorry, could you say that again?' : 'Goodbye!');
    transcript.push({ role: 'ai', text: reply, at: new Date().toISOString() });
    await db
        .from('calls')
        .update({ messages: result.messages, transcript, contact_id: contactId, lead_captured: Boolean(contactId) })
        .eq('id', call.id);

    if (result.action === 'hangup') {
        twiml.say({ voice: VOICE }, reply);
        twiml.hangup();
    } else if (result.action === 'transfer') {
        twiml.say({ voice: VOICE }, reply);
        twiml.dial(subaccount.transfer_number);
    } else {
        gather(twiml, call.id, reply);
    }
    return twimlResponse(twiml);
}
