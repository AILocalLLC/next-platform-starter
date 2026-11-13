import twilio from 'twilio';
import { createAdminClient } from 'lib/supabase/admin';
import { relayTwiml, usesRelay } from 'lib/relay';
import { forbidden, gather, readTwilioRequest, twimlResponse, VOICE } from 'lib/voice';
import { usDestination } from 'lib/phone';

// Twilio voice webhook for every subaccount number (set automatically by "Connect number").
export async function POST(request) {
    const params = await readTwilioRequest(request);
    if (!params) return forbidden();

    const db = createAdminClient();
    const twiml = new twilio.twiml.VoiceResponse();
    const { data: subaccount } = await db.from('subaccounts').select('*').eq('twilio_number', params.To).maybeSingle();

    if (!subaccount || !subaccount.receptionist_enabled) {
        const transferTo = usDestination(subaccount?.transfer_number, 'transfer');
        if (transferTo) twiml.dial(transferTo);
        else {
            twiml.say({ voice: VOICE }, 'Sorry, no one is available to take your call. Please try again later.');
            twiml.hangup();
        }
        return twimlResponse(twiml);
    }

    const { data: call, error } = await db
        .from('calls')
        .upsert(
            {
                subaccount_id: subaccount.id,
                twilio_call_sid: params.CallSid,
                from_number: params.From,
                to_number: params.To,
                transcript: [{ role: 'ai', text: subaccount.greeting, at: new Date().toISOString() }]
            },
            { onConflict: 'twilio_call_sid' }
        )
        .select('id')
        .single();
    if (error) {
        console.error('call insert failed', error);
        twiml.say({ voice: VOICE }, 'Sorry, we are having trouble right now. Please call back shortly.');
        twiml.hangup();
        return twimlResponse(twiml);
    }

    if (usesRelay(subaccount)) relayTwiml(twiml, { callId: call.id, greeting: subaccount.greeting });
    else gather(twiml, call.id, subaccount.greeting);
    return twimlResponse(twiml);
}
