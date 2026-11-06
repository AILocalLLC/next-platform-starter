import { createHmac, timingSafeEqual } from 'node:crypto';
import { speakable } from './speech.js';

// Twilio ConversationRelay engine. Twilio streams the call to a small WebSocket bridge on Google Cloud
// (CRM API, /api/v1/voice-relay). The bridge only passes words: it posts each caller turn to
// /api/voice/relay-turn here and speaks back the reply. Ari's logic stays in this app.
// The bridge holds no secrets: each call's WebSocket URL carries a signature (HMAC of the call id with
// the Twilio auth token) that the bridge passes back and relay-turn checks.
export const RELAY_WS_URL = process.env.RELAY_WS_URL || 'wss://api-596595914790.us-central1.run.app/api/v1/voice-relay';
// Same Amazon voice as the <Gather> engine's Polly.Joanna-Neural.
export const RELAY_VOICE = process.env.RELAY_VOICE || 'Joanna-Neural';

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
        welcomeGreeting: speakable(greeting),
        ttsProvider: 'Amazon',
        voice: RELAY_VOICE,
        language: 'en-US',
        // Deepgram Flux decides the caller has finished from what they say, not from a fixed silence, so it
        // doesn't cut people off at a pause. Live tests (Nov 2026): the default and Google split sentences; Flux didn't.
        transcriptionProvider: 'Deepgram',
        speechModel: 'flux-general-en',
        // Callers can talk over Ari and she stops, like a person would; 'low' so background noise doesn't.
        interruptible: 'speech',
        interruptSensitivity: 'low'
    });
}
