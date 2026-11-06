import twilio from 'twilio';
import { createAdminClient } from 'lib/supabase/admin';
import { forbidden, gather, readTwilioRequest, twimlForAction, twimlResponse, VOICE } from 'lib/voice';
import { voiceTurn } from 'lib/voiceTurn';

export const maxDuration = 26;

// Twilio <Gather> engine: one webhook per caller turn.
export async function POST(request) {
    const params = await readTwilioRequest(request);
    if (!params) return forbidden();
    const t0 = Date.now();

    const search = new URL(request.url).searchParams;
    const callId = search.get('call');
    const silent = Number(search.get('silent') || 0);
    // Second half of a turn that already spoke ("let me check...", or words that came with a lead save)
    // and now runs its calendar tools or fetches the next question.
    const resume = search.get('resume') === '1';
    const db = createAdminClient();
    const twiml = new twilio.twiml.VoiceResponse();

    const { data: call } = await db.from('calls').select('*, subaccounts(*)').eq('id', callId).maybeSingle();
    if (!call || call.twilio_call_sid !== params.CallSid) return forbidden();
    const loadMs = Date.now() - t0;

    const { reply, action, silent: wasSilent } = await voiceTurn({ db, call, speech: params.SpeechResult, resume, silent, loadMs });

    if (wasSilent && action === 'continue') {
        gather(twiml, call.id, reply, silent);
    } else if (wasSilent) {
        twiml.say({ voice: VOICE }, reply);
        twiml.hangup();
    } else {
        twimlForAction(twiml, call, reply, action);
    }
    return twimlResponse(twiml);
}
