// Bridge to the AI Local CRM (crm.ailocal.net; its API runs on Cloud Run).
// - Ari's leads are sent into the CRM's lead intake (same one the website form uses).
// - The CRM calls /api/leads/alert for every other new lead, and we text the owner.
// Both directions are signed with the shared LEAD_ALERT_KEY in the x-lead-alert-key header.
import { timingSafeEqual } from 'node:crypto';

export function keyMatches(given, expected) {
    if (!given || !expected) return false;
    const a = Buffer.from(String(given));
    const b = Buffer.from(String(expected));
    return a.length === b.length && timingSafeEqual(a, b);
}

function noteLine(notes, label) {
    const m = String(notes || '').match(new RegExp(`^${label}:\\s*(.+)$`, 'mi'));
    return m ? m[1].trim() : undefined;
}

// CRM intake payload for a lead Ari captured.
export function crmLeadFromContact(slug, contact, summary, channel = 'phone') {
    const parts = String(contact.name || '').trim().split(/\s+/).filter(Boolean);
    return {
        slug,
        firstName: parts[0] || 'Lead',
        lastName: parts.slice(1).join(' ') || undefined,
        phone: contact.phone || undefined,
        email: contact.email || undefined,
        address: noteLine(contact.notes, 'Address'),
        jobType: noteLine(contact.notes, 'Service'),
        notes: summary && summary !== 'Summary unavailable.' ? summary : undefined,
        source: channel === 'web' ? 'Ari website chat' : 'Ari phone call'
    };
}

export async function pushLeadToCrm(lead, { env = process.env, fetchImpl = fetch } = {}) {
    if (!env.LEAD_ALERT_KEY) return 'not-configured';
    const base = (env.CRM_API_URL || 'https://api-596595914790.us-central1.run.app').replace(/\/$/, '');
    const res = await fetchImpl(`${base}/api/v1/funnels/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-lead-alert-key': env.LEAD_ALERT_KEY },
        body: JSON.stringify(lead),
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`CRM intake failed: ${res.status}`);
    return 'sent';
}

function clean(v, max = 200) {
    return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function prettySource(source) {
    const s = clean(source, 60);
    if (!s || /^website\b/i.test(s)) return 'website form';
    return s;
}

// Owner text for a lead the CRM received (website form, referral, ...).
export function leadAlertText(lead) {
    const name = clean([lead.firstName, lead.lastName].filter((x) => x && x !== 'Lead').join(' '), 80) || 'No name';
    const lines = [
        `New lead (${prettySource(lead.source)}): ${name}`,
        lead.phone && `Phone: ${clean(lead.phone, 40)}`,
        lead.email && `Email: ${clean(lead.email, 100)}`,
        lead.address && `Address: ${clean(lead.address)}`,
        lead.jobType && `Job: ${clean(lead.jobType, 100)}`,
        lead.notes && `Notes: ${clean(lead.notes, 600)}`
    ];
    return lines.filter(Boolean).join('\n').slice(0, 1500);
}

// Text for a CRM automation step. In test mode the text goes to the owner instead
// of the lead, marked TEST with who it would have gone to.
export function automationText({ body, test, contactName, to }) {
    const text = clean(body, 640);
    if (!test) return text;
    const who = [clean(contactName, 60) || 'lead', clean(to, 20)].filter(Boolean).join(' ');
    return `TEST (would go to ${who}): ${text}`.slice(0, 760);
}

// ---- Inbox: copy every text, call and chat into the CRM's Inbox ----

// Event for one text. direction: 'in' (customer -> business) or 'out'.
export function smsInboxEvent(subaccount, { direction, phone, body, media = [], sid, name }) {
    return {
        type: 'sms',
        direction,
        phone,
        name: name || undefined,
        body: String(body || ''),
        media,
        externalId: sid || undefined,
        slug: subaccount.crm_funnel_slug || undefined,
        business: subaccount.twilio_number || undefined
    };
}

// Event for a finished phone call or website chat, with its summary.
export function callInboxEvent(subaccount, call, contact, summary) {
    const web = call.channel === 'web';
    return {
        type: web ? 'chat' : 'call',
        direction: 'in',
        phone: contact?.phone || (web ? undefined : call.from_number) || undefined,
        email: contact?.email || undefined,
        name: contact?.name || undefined,
        body: `${web ? 'Website chat with the AI assistant' : 'Call answered by the AI receptionist'}${call.duration_seconds ? ` (${Math.round(call.duration_seconds / 60) || 1} min)` : ''}. ${summary || 'Summary unavailable.'}`,
        externalId: `call:${call.id}`,
        at: call.started_at || undefined,
        slug: subaccount.crm_funnel_slug || undefined,
        business: subaccount.twilio_number || undefined
    };
}

export function voicemailInboxEvent(subaccount, call, text) {
    return {
        type: 'voicemail',
        direction: 'in',
        phone: call.from_number || undefined,
        body: `Voicemail: ${text}`,
        externalId: `vm:${call.id}`,
        slug: subaccount.crm_funnel_slug || undefined,
        business: subaccount.twilio_number || undefined
    };
}

// Sends one event to the CRM. Never throws: the inbox copy must not break calls or texts.
export async function pushInboxEvent(event, { env = process.env, fetchImpl = fetch } = {}) {
    if (!env.LEAD_ALERT_KEY) return 'not-configured';
    if (!event.slug && !event.business) return 'no-business';
    if (!event.phone && !event.email) return 'no-contact';
    try {
        const base = (env.CRM_API_URL || 'https://api-596595914790.us-central1.run.app').replace(/\/$/, '');
        const res = await fetchImpl(`${base}/api/v1/inbox/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-lead-alert-key': env.LEAD_ALERT_KEY },
            body: JSON.stringify(event),
            signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) {
            console.error('CRM inbox push failed', res.status);
            return `http-${res.status}`;
        }
        return 'sent';
    } catch (err) {
        console.error('CRM inbox push failed', err?.message);
        return 'error';
    }
}
