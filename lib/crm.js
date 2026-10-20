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
