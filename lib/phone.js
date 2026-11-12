export function toE164(raw) {
    if (!raw) return null;
    const d = raw.replace(/[^\d+]/g, '');
    if (d.startsWith('+')) return d;
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith('1')) return `+${d}`;
    return d || null;
}

// +1 area codes that are other countries (Caribbean, Bermuda) or premium-rate 900:
// the usual toll-fraud and SMS-pumping targets.
const NOT_US_CA = new Set('242 246 264 268 284 345 441 473 649 658 664 721 758 767 784 809 829 849 868 869 876 900'.split(' '));

// US/Canada mobile or landline in +1 form, else null. Used before sending a text
// so the app can't be used to text premium or overseas numbers.
export function toUsE164(raw) {
    const n = toE164(raw ? String(raw) : raw);
    return n && /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(n) && !NOT_US_CA.has(n.slice(2, 5)) ? n : null;
}

// Where a text or transfer may go: US/Canada only, else null and a warning (never throws,
// so a bad saved number can't break a call). Stops toll fraud and SMS pumping.
export function usDestination(raw, what = 'outbound') {
    if (!raw) return null;
    const n = toUsE164(raw);
    if (!n) console.warn(`${what}: skipped a non-US/Canada number`);
    return n;
}

const PHONE_LABELS = { business_phone: 'Business phone', notify_phone: 'The alert phone', transfer_number: 'Transfer number' };

// A phone field from a settings form: blank is fine, anything else must be US/Canada.
export function usPhoneField(key, raw) {
    if (!raw) return { value: null };
    const value = toUsE164(raw);
    return value ? { value } : { error: `${PHONE_LABELS[key] || 'Phone'} must be a US or Canada number.` };
}

// True when the number is one of the platform's own Twilio numbers.
export async function isOwnNumber(db, number) {
    const { data } = await db.from('subaccounts').select('id').eq('twilio_number', number).limit(1);
    return Boolean(data?.length);
}
