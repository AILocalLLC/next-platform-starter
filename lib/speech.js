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
