// Create or update the contact linked to a conversation. Returns the contact id.
export async function upsertLead(db, { subaccountId, contactId, lead, fallbackPhone, source }) {
    const row = {
        subaccount_id: subaccountId,
        name: lead.name,
        phone: lead.phone || fallbackPhone || null,
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

export function confirmationText(subaccount, contact) {
    const first = (contact.name || '').trim().split(/\s+/)[0];
    return `${first ? `Thanks ${first}! ` : 'Thanks! '}${subaccount.name} got your request. A team member will reach out within a few hours to confirm. Reply STOP to opt out.`;
}
