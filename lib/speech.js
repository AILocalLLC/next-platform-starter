// Text-to-speech reads "44647" as "forty-four thousand..." and runs phone numbers together.
// Space out zip codes and phone numbers so they are read digit by digit, the way people say them.
export function speakable(text) {
    const digits = (d) => d.split('').join(' ');
    return String(text || '')
        .replace(/\b(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g, (_, a, b, c) => `${digits(a)}, ${digits(b)}, ${digits(c)}`)
        .replace(/\b\d{5}(?:-\d{4})?\b/g, (zip) => zip.split('-').map(digits).join(', '));
}
