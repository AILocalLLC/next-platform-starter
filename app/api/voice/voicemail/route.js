import twilio from 'twilio';
import { createAdminClient } from 'lib/supabase/admin';
import { forbidden, readTwilioRequest, say, twimlResponse } from 'lib/voice';

// Voicemail fallback (used when the AI can't answer). Twilio calls this twice:
// ?done=1 when the recording ends (we say goodbye), and again with the transcription text.
export async function POST(request) {
    const params = await readTwilioRequest(request);
    if (!params) return forbidden();
    const search = new URL(request.url).searchParams;

    if (search.get('done') === '1') {
        const twiml = new twilio.twiml.VoiceResponse();
        say(twiml, 'Thanks, we got your message. Goodbye!');
        twiml.hangup();
        return twimlResponse(twiml);
    }

    const db = createAdminClient();
    const { data: call } = await db.from('calls').select('id, from_number, transcript, summary, twilio_call_sid, subaccounts(*)').eq('id', search.get('call')).maybeSingle();
    if (!call || call.twilio_call_sid !== params.CallSid) return forbidden();

    const text = params.TranscriptionStatus === 'completed' && params.TranscriptionText ? params.TranscriptionText.trim() : '(could not transcribe; listen in Twilio)';
    await db
        .from('calls')
        .update({
            transcript: [...call.transcript, { role: 'caller', text: `Voicemail: ${text}`, at: new Date().toISOString() }],
            // The call usually ends (and is summarized) before Twilio finishes the transcription.
            ...(call.summary ? { summary: `${call.summary} Voicemail: ${text}` } : {})
        })
        .eq('id', call.id);

    const subaccount = call.subaccounts;
    if (subaccount?.notify_phone && subaccount.twilio_number && process.env.TWILIO_ACCOUNT_SID) {
        try {
            await twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).messages.create({
                from: subaccount.twilio_number,
                to: subaccount.notify_phone,
                body: `Voicemail for ${subaccount.name} from ${call.from_number || 'unknown'}: ${text}`.slice(0, 1500)
            });
        } catch (err) {
            console.error('voicemail SMS failed', err);
        }
    }
    return new Response(null, { status: 204 });
}
