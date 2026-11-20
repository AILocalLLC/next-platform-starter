import { createHash } from 'node:crypto';

// Limits on the public website chat, so nobody can run up the AI bill.
// - Per visitor IP in memory (one warm server) and new chats per IP per hour in the database.
// - Per business: new chats per hour, counted in the database (holds across servers).
// Each session already stops after 30 visitor messages (see the chat route).

export const LIMITS = {
    ipMessagesPer10Min: 40,
    ipNewChatsPerHour: 10,
    ipNewChatsPerHourDb: 20,
    businessNewChatsPerHour: 60
};

// Netlify sets x-nf-client-connection-ip itself, so visitors can't fake it.
export function visitorIp(headers) {
    const nf = headers.get('x-nf-client-connection-ip');
    if (nf) return nf.trim().slice(0, 64);
    const xff = (headers.get('x-forwarded-for') || '').split(',')[0].trim();
    return (xff || 'unknown').slice(0, 64);
}

// Sliding-window counter: hit(key, limit, windowMs) -> true when allowed.
export function createLimiter({ now = () => Date.now(), maxKeys = 10000 } = {}) {
    const hits = new Map();
    return function hit(key, limit, windowMs) {
        const t = now();
        const list = (hits.get(key) || []).filter((at) => t - at < windowMs);
        if (list.length >= limit) {
            hits.set(key, list);
            return false;
        }
        list.push(t);
        hits.delete(key);
        hits.set(key, list);
        if (hits.size > maxKeys) hits.delete(hits.keys().next().value);
        return true;
    };
}

export async function businessChatsLastHour(db, subaccountId, now = new Date()) {
    const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { count, error } = await db.from('calls').select('id', { count: 'exact', head: true }).eq('subaccount_id', subaccountId).eq('channel', 'web').gte('started_at', since);
    if (error) throw error;
    return count || 0;
}

// Salted hash of the visitor IP (raw IPs are never stored). Null when the IP is unknown,
// so visitors without one don't share a single bucket.
const IP_SALT = 'ailocal-chat-ip-v1';
export function hashIp(ip) {
    if (!ip || ip === 'unknown') return null;
    return createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex');
}

export async function ipChatsLastHour(db, ipHash, now = new Date()) {
    if (!ipHash) return 0;
    const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { count, error } = await db.from('calls').select('id', { count: 'exact', head: true }).eq('client_ip_hash', ipHash).eq('channel', 'web').gte('started_at', since);
    if (error) throw error;
    return count || 0;
}
