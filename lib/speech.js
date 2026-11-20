// Text-to-speech reads "44647" as "forty-four thousand..." and runs phone numbers together.
// Space out zip codes and phone numbers so they are read digit by digit, the way people say them.
const digits = (d) => d.split('').join(' ');

export function speakable(text) {
    return (
        String(text || '')
            // Phone numbers: 3305551212, 330-555-1212, (330) 555-1212, +13305551212, +1 330 555 1212
            .replace(/(?<![\d$])(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})(?!\d)/g, (_, a, b, c) => `${digits(a)}, ${digits(b)}, ${digits(c)}`)
            // Zip codes: 5 digits (optional +4), but not money like $12000 or amounts like 12000 sq ft
            .replace(/(?<![$\d,.])\b(\d{5})(?:-(\d{4}))?\b(?!\s*(?:dollars|sq|square|feet|ft|miles|%))/gi, (_, zip, plus4) =>
                plus4 ? `${digits(zip)}, ${digits(plus4)}` : digits(zip)
            )
    );
}

// Ari speaks 15% faster than the voice's default pace (Ted, Nov 2026). Applied as an SSML speaking
// rate, so the voice itself is unchanged. Measured on live test calls with Google Chirp3-HD-Leda:
// 12-18% shorter speech, no extra delay before short replies.
export const SPEECH_RATE = '115%';

const escapeXml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Text for ConversationRelay (bridge tokens and the welcome greeting), which Twilio reads as SSML.
export function atSpeechRate(text) {
    const t = String(text || '');
    return t.trim() ? `<prosody rate="${SPEECH_RATE}">${escapeXml(t)}</prosody>` : '';
}

// <Say> at Ari's speaking rate (Gather engine and hand-off lines). Twilio escapes the text.
export function sayAtRate(node, voice, text) {
    node.say({ voice }).prosody({ rate: SPEECH_RATE }, String(text || ''));
}
