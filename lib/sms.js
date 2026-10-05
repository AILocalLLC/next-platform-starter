// Two-way texting helpers. Pure functions are exported for tests; db helpers take a Supabase client.

// Postgres "undefined table" or PostgREST "table not in schema cache": migration 0004 not applied yet.
export function isMissingTable(error) {
    return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205'));
}

export function mediaUrls(params) {
    const n = Number(params.NumMedia || 0);
    return Array.from({ length: n }, (_, i) => params[`MediaUrl${i}`]).filter(Boolean);
}

export function forwardText(subaccount, { name, phone, body, media = [] }) {
    const who = name ? `${name} (${phone})` : phone;
    const extra = media.length ? ` [${media.length} attachment${media.length > 1 ? 's' : ''}]` : '';
    return `Text to ${subaccount.name} from ${who}: ${body || ''}${extra}`.slice(0, 1500);
}

// Latest message per customer phone, newest first.
export function threadsFrom(messages) {
    const seen = new Map();
    for (const m of messages) if (!seen.has(m.phone)) seen.set(m.phone, m);
    return [...seen.values()];
}

export async function findOrCreateContact(db, subaccountId, phone) {
    const { data: found } = await db.from('contacts').select('id, name').eq('subaccount_id', subaccountId).eq('phone', phone).limit(1).maybeSingle();
    if (found) return found;
    const { data, error } = await db.from('contacts').insert({ subaccount_id: subaccountId, phone, source: 'sms' }).select('id, name').single();
    if (error) throw new Error(error.message);
    return data;
}
