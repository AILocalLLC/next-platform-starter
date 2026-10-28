export function toE164(raw) {
    if (!raw) return null;
    const d = raw.replace(/[^\d+]/g, '');
    if (d.startsWith('+')) return d;
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith('1')) return `+${d}`;
    return d || null;
}

// US/Canada mobile or landline in +1 form, else null. Used before sending a text
// so the app can't be used to text premium or overseas numbers.
export function toUsE164(raw) {
    const n = toE164(raw ? String(raw) : raw);
    return n && /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(n) ? n : null;
}

// True when the number is one of the platform's own Twilio numbers.
export async function isOwnNumber(db, number) {
    const { data } = await db.from('subaccounts').select('id').eq('twilio_number', number).limit(1);
    return Boolean(data?.length);
}
