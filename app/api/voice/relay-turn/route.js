import { createAdminClient } from 'lib/supabase/admin';
import { relaySigOk, relaySpeakable } from 'lib/relay';
import { voiceTurn } from 'lib/voiceTurn';

export const maxDuration = 26;

// ConversationRelay engine: the WebSocket bridge posts each caller turn here as JSON
// { call, sig, callSid, text, resume, silent } and speaks back { reply, action }.
export async function POST(request) {
    const t0 = Date.now();
    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'bad request' }, { status: 400 });
    }
    const { call: callId, sig, callSid } = body || {};
    if (!callId || !relaySigOk(String(callId), sig)) return Response.json({ error: 'forbidden' }, { status: 403 });

    const db = createAdminClient();
    const { data: call } = await db.from('calls').select('*, subaccounts(*)').eq('id', callId).maybeSingle();
    if (!call || !callSid || call.twilio_call_sid !== callSid) return Response.json({ error: 'forbidden' }, { status: 403 });

    const args = {
        db,
        call,
        speech: typeof body.text === 'string' ? body.text.slice(0, 2000) : '',
        resume: body.resume === true,
        silent: Math.min(Number(body.silent) || 0, 5),
        loadMs: Date.now() - t0
    };
    if (body.stream !== true) {
        const { reply, action } = await voiceTurn(args);
        return Response.json({ reply: relaySpeakable(reply), action });
    }
    // Streamed: one JSON line per finished sentence ({ text }), then { done, rest, reply, action }.
    const enc = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (obj) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
            try {
                const { reply, rest, action } = await voiceTurn({ ...args, onText: (sentence) => send({ text: relaySpeakable(sentence) }) });
                send({ done: true, rest: relaySpeakable(rest), reply: relaySpeakable(reply), action });
            } catch (err) {
                console.error('relay-turn stream failed', err);
                send({ done: true, error: true });
            }
            controller.close();
        }
    });
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache, no-transform' } });
}
