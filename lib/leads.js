import { toE164 } from './phone.js';

// Create or update the contact linked to a conversation. Returns the contact id.
export async function upsertLead(db, { subaccountId, contactId, lead, fallbackPhone, source }) {
    const row = {
        subaccount_id: subaccountId,
        name: lead.name,
        phone: toE164(lead.phone) || fallbackPhone || null,
        email: lead.email || null,
        source,
        notes: [
            lead.service && `Service: ${lead.service}`,
            lead.address && `Address: ${lead.address}`,
            lead.reason,
            lead.callback_time && `Preferred time: ${lead.callback_time}`,
            lead.callback_requested && 'Requested a live callback'
        ]
            .filter(Boolean)
            .join('\n')
    };
    // Only ever add the tag; a later update without the flag must not clear it.
    if (lead.callback_requested) row.tags = ['callback-requested'];
    const res = contactId
        ? await db.from('contacts').update(row).eq('id', contactId).select('id').single()
        : await db.from('contacts').insert(row).select('id').single();
    if (res.error) throw new Error(res.error.message);
    return res.data.id;
}

export function confirmationText(subaccount, contact, appointmentLabel = null) {
    const first = (contact.name || '').trim().split(/\s+/)[0];
    const hi = first ? `Thanks ${first}! ` : 'Thanks! ';
    return appointmentLabel
        ? `${hi}Your ${subaccount.name} appointment is booked for ${appointmentLabel}. Reply STOP to opt out.`
        : `${hi}${subaccount.name} got your request. A team member will reach out within a few hours to confirm. Reply STOP to opt out.`;
}

// Plain-text summary for SMS and notes: no markdown bold/headers and no leading "Summary:" label.
export function cleanSummary(summary) {
    return String(summary || '')
        .replace(/\*\*/g, '')
        .replace(/^#+\s*/gm, '')
        .trim()
        .replace(/^(call\s+)?summary\s*(:\s*|\n)/i, '')
        .trim();
}

// Contact notes plus the end-of-call summary, so details learned after the lead was saved
// (address, job, callback request) are kept even when the caller hangs up first.
export function notesWithSummary(notes, summary, at = new Date()) {
    const clean = cleanSummary(summary);
    if (!clean || clean === 'Summary unavailable.') return null;
    const date = new Date(at).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
    const block = `Call summary (${date}):\n${clean}`;
    return notes?.trim() ? `${notes.trim()}\n\n${block}` : block;
}

// Links in the owner alert are removed: the summary is written from caller words, so it could carry phishing links.
// Email addresses stay (a lead's email is useful).
const LINK = /\b(?:https?:\/\/|www\.)\S+|(?<![@\w.-])(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|ly|me|info|biz|us|link|xyz|app|site|online|gl|to)\b(?:\/\S*)?/gi;
export const OWNER_SUMMARY_MAX = 300;

export function ownerAlertSummary(summary) {
    const text = cleanSummary(summary).replace(LINK, '[link removed]').replace(/\s+/g, ' ').trim();
    return text.length > OWNER_SUMMARY_MAX ? `${text.slice(0, OWNER_SUMMARY_MAX - 3).trimEnd()}...` : text;
}

// Fixed prefix (business name + "Call summary:") so the text can't pass as a different kind of message.
export function ownerAlertText(subaccount, call, summary) {
    const from = call.channel === 'web' ? 'website chat' : call.from_number || 'unknown';
    return `${subaccount.name} - Call summary: New lead from ${from}: ${ownerAlertSummary(summary) || 'Summary unavailable.'}`;
}
