// Create or update the contact linked to a conversation. Returns the contact id.
export async function upsertLead(db, { subaccountId, contactId, lead, fallbackPhone, source }) {
    const row = {
        subaccount_id: subaccountId,
        name: lead.name,
        phone: lead.phone || fallbackPhone || null,
        email: lead.email || null,
        source,
        notes: [lead.reason, lead.callback_time && `Preferred time: ${lead.callback_time}`].filter(Boolean).join('\n')
    };
    const res = contactId
        ? await db.from('contacts').update(row).eq('id', contactId).select('id').single()
        : await db.from('contacts').insert(row).select('id').single();
    if (res.error) throw new Error(res.error.message);
    return res.data.id;
}
