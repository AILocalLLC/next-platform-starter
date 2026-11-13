import { createHmac, timingSafeEqual } from 'node:crypto';
import { speakable } from './speech.js';

// Twilio ConversationRelay engine. Twilio streams the call to a small WebSocket bridge on Google Cloud
// (CRM API, /api/v1/voice-relay). The bridge only passes words: it posts each caller turn to
// /api/voice/relay-turn here and speaks back the reply. Ari's logic stays in this app.
// The bridge holds no secrets: each call's WebSocket URL carries a signature (HMAC of the call id with
// the Twilio auth token) that the bridge passes back and relay-turn checks.
export const RELAY_WS_URL = process.env.RELAY_WS_URL || 'wss://api-596595914790.us-central1.run.app/api/v1/voice-relay';
// Same voice as the <Gather> engine (TWILIO_VOICE, e.g. "Google.en-US-Chirp3-HD-Leda" or "Polly.Joanna-Neural"),
// so switching engines never changes how Ari sounds.
export function relayVoiceFor(sayVoice) {
    const [prefix, ...rest] = String(sayVoice || '').split('.');
    const voice = rest.join('.');
    if (prefix === 'Google' && voice) return { provider: 'Google', voice };
    if (prefix === 'Polly' && voice) return { provider: 'Amazon', voice };
    return { provider: 'Amazon', voice: 'Joanna-Neural' };
}
// The <Say> voice for the hand-off lines relay-done speaks (goodbye, transfer, voicemail).
export const RELAY_SAY_VOICE = process.env.TWILIO_VOICE || 'Polly.Joanna-Neural';
const { provider: RELAY_TTS_PROVIDER, voice: RELAY_VOICE } = relayVoiceFor(RELAY_SAY_VOICE);
export { RELAY_TTS_PROVIDER, RELAY_VOICE };

// Text for this engine's voice: digits spaced out as with <Say>, and "A.I." read as one word
// (the periods made it pause as if the sentence had ended).
export function relaySpeakable(text) {
    return speakable(text).replace(/\bA\.I\.(?=\s|$|[,;:!?])/g, 'AI');
}

export function relaySig(callId, key = process.env.TWILIO_AUTH_TOKEN) {
    if (!key || !callId) return null;
    return createHmac('sha256', key).update(`relay:${callId}`).digest('hex');
}

export function relaySigOk(callId, sig, key = process.env.TWILIO_AUTH_TOKEN) {
    const want = relaySig(callId, key);
    if (!want || typeof sig !== 'string' || sig.length !== want.length) return false;
    return timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}

export function usesRelay(subaccount) {
    return subaccount?.voice_engine === 'relay' && Boolean(process.env.TWILIO_AUTH_TOKEN);
}

// <Connect><ConversationRelay>. When the session ends Twilio posts to relay-done, which hangs up,
// transfers, takes a voicemail, or (if the bridge failed) carries on with the <Gather> engine.
export function relayTwiml(twiml, { callId, greeting }) {
    const url = `${RELAY_WS_URL}?call=${encodeURIComponent(callId)}&sig=${relaySig(callId)}`;
    const connect = twiml.connect({ action: `/api/voice/relay-done?call=${callId}`, method: 'POST' });
    connect.conversationRelay({
        url,
        welcomeGreeting: relaySpeakable(greeting),
        ttsProvider: RELAY_TTS_PROVIDER,
        voice: RELAY_VOICE,
        language: 'en-US',
        // Deepgram Flux decides the caller has finished from what they say, not from a fixed silence, so it
        // doesn't cut people off at a pause. Live tests (Nov 2026): the default and Google split sentences; Flux didn't.
        transcriptionProvider: 'Deepgram',
        speechModel: 'flux-general-en',
        // Callers can talk over Ari and she stops and listens, like a person would. Twilio's default
        // sensitivity: with 'low', a caller talking over a long answer was not heard at all (Nov 2026).
        interruptible: 'speech',
        // Interim results while the caller talks, so the bridge knows a long sentence isn't silence.
        partialPrompts: true
    });
}
