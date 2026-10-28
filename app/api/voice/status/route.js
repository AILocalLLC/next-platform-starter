import { createAdminClient } from 'lib/supabase/admin';
import { finalizeCall, forbidden, readTwilioRequest } from 'lib/voice';

const FINAL = ['completed', 'busy', 'failed', 'no-answer', 'canceled'];

// Twilio "Call status changes" webhook: summarize and notify when the call ends.
export async function POST(request) {
    const params = await readTwilioRequest(request);
    if (!params) return forbidden();
    if (!FINAL.includes(params.CallStatus)) return new Response(null, { status: 204 });

    const db = createAdminClient();
    const { data: call } = await db.from('calls').select('id').eq('twilio_call_sid', params.CallSid).maybeSingle();
    if (call) await finalizeCall(call.id, { status: params.CallStatus, duration: params.CallDuration });
    return new Response(null, { status: 204 });
}
