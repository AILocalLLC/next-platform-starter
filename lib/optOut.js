// SMS opt-outs (STOP / START), per business. Table: sms_opt_outs (migration 0012).
import { usDestination } from './phone.js';
import { isMissingTable } from './sms.js';

// Carrier-standard keywords: the whole message, any case.
const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const START_WORDS = new Set(['START', 'UNSTOP', 'YES']);

export function optOutKeyword(body) {
    const word = String(body || '').trim().toUpperCase();
    if (STOP_WORDS.has(word)) return 'stop';
    if (START_WORDS.has(word)) return 'start';
    return null;
}

// Saves or clears the opt-out when an incoming text is a keyword. Returns 'stop', 'start' or null.
export async function applyOptOutKeyword(db, subaccountId, phone, body) {
    const kw = optOutKeyword(body);
    if (!kw || !phone) return null;
    const table = db.from('sms_opt_outs');
    const { error } = kw === 'stop'
        ? await table.upsert({ subaccount_id: subaccountId, phone, opted_out_at: new Date().toISOString() }, { onConflict: 'subaccount_id,phone' })
        : await table.delete().eq('subaccount_id', subaccountId).eq('phone', phone);
    if (error && !isMissingTable(error)) console.error('opt-out save failed', error.message);
    return kw;
}

// Throws on a database error, so a failed check never sends.
export async function isOptedOut(db, subaccountId, phone) {
    const { data, error } = await db.from('sms_opt_outs').select('phone').eq('subaccount_id', subaccountId).eq('phone', phone).limit(1).maybeSingle();
    if (error) {
        if (isMissingTable(error)) return false; // migration 0012 not applied yet
        throw new Error(`opt-out check failed: ${error.message}`);
    }
    return Boolean(data);
}

// Where a text to a customer may go: { to } or { skipped: 'not_us' | 'opted_out' }.
export async function customerTextTo(db, subaccountId, raw, what = 'customer text') {
    const to = usDestination(raw, what);
    if (!to) return { skipped: 'not_us' };
    if (await isOptedOut(db, subaccountId, to)) return { skipped: 'opted_out' };
    return { to };
}
