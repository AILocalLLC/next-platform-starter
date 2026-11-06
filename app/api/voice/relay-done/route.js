import twilio from 'twilio';
import { createAdminClient } from 'lib/supabase/admin';
import { forbidden, gather, readTwilioRequest, twimlForAction, twimlResponse } from 'lib/voice';

const HANDOFF = ['hangup', 'transfer', 'voicemail'];

// Twilio posts here when a ConversationRelay session ends. The bridge ends it with HandoffData
// { action, reply } for a hang-up, transfer or voicemail; the reply is spoken here (same voice) so it
// is never cut off. Anything else (bridge down, socket error) carries on with the <Gather> engine.
export async function POST(request) {
    const params = await readTwilioRequest(request);
    if (!params) return forbidden();
    const callId = new URL(request.url).searchParams.get('call');
    const db = createAdminClient();
    const { data: call } = await db.from('calls').select('id, twilio_call_sid, subaccounts(transfer_number)').eq('id', callId).maybeSingle();
    if (!call || call.twilio_call_sid !== params.CallSid) return forbidden();

    const twiml = new twilio.twiml.VoiceResponse();
    if (params.CallStatus === 'completed') return twimlResponse(twiml);

    let handoff = {};
    try {
        handoff = JSON.parse(params.HandoffData || '{}') || {};
    } catch {
        handoff = {};
    }
    const action = HANDOFF.includes(handoff.action) ? handoff.action : null;
    if (action === 'transfer' && !call.subaccounts?.transfer_number) {
        twimlForAction(twiml, call, String(handoff.reply || ''), 'hangup');
    } else if (action) {
        twimlForAction(twiml, call, String(handoff.reply || '').slice(0, 1000), action);
    } else {
        console.error('relay session ended without hand-off', call.id, params.SessionStatus || '', params.ErrorCode || '', params.ErrorMessage || '');
        gather(twiml, call.id, "Sorry, I missed that. Could you say it again?");
    }
    return twimlResponse(twiml);
}
