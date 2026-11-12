import twilio from 'twilio';
import { createAdminClient } from 'lib/supabase/admin';
import { findOrCreateContact, forwardText, isMissingTable, mediaUrls } from 'lib/sms';
import { forbidden, readTwilioRequest } from 'lib/voice';
import { pushInboxEvent, smsInboxEvent } from 'lib/crm';
import { usDestination } from 'lib/phone';
import { applyOptOutKeyword } from 'lib/optOut';

const EMPTY = () => new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } });

// Twilio "A message comes in" webhook: save the text to the inbox and forward it to the owner's phone.
export async function POST(request) {
    const params = await readTwilioRequest(request);
    if (!params) return forbidden();

    const db = createAdminClient();
    const { data: subaccount } = await db.from('subaccounts').select('*').eq('twilio_number', params.To).maybeSingle();
    if (!subaccount) return EMPTY();

    const phone = params.From;
    const body = params.Body || '';
    const media = mediaUrls(params);
    const fromOwner = phone === subaccount.notify_phone;

    // STOP / START: Twilio sends the carrier reply itself (Advanced Opt-Out), so we only record it.
    await applyOptOutKeyword(db, subaccount.id, phone, body);

    let contact = null;
    if (!fromOwner) {
        try {
            contact = await findOrCreateContact(db, subaccount.id, phone);
        } catch (err) {
            console.error('sms contact failed', err);
        }
    }

    const { data: saved, error } = await db
        .from('messages')
        .upsert(
            { subaccount_id: subaccount.id, contact_id: contact?.id ?? null, direction: 'in', phone, body, media_urls: media, twilio_sid: params.MessageSid, status: 'received' },
            { onConflict: 'twilio_sid', ignoreDuplicates: true }
        )
        .select('id');
    if (error && !isMissingTable(error)) console.error('sms save failed', error);
    // Twilio retried a message we already have: it was forwarded the first time.
    if (!error && !saved?.length) return EMPTY();

    // Copy it into the CRM Inbox.
    if (!fromOwner) {
        await pushInboxEvent(smsInboxEvent(subaccount, { direction: 'in', phone, body, media, sid: params.MessageSid, name: contact?.name }));
    }

    // Owner's own texts to the business line are not forwarded back to them.
    const ownerPhone = fromOwner ? null : usDestination(subaccount.notify_phone, 'sms forward');
    if (ownerPhone && process.env.TWILIO_ACCOUNT_SID) {
        try {
            await twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).messages.create({
                from: subaccount.twilio_number,
                to: ownerPhone,
                body: forwardText(subaccount, { name: contact?.name, phone, body, media })
            });
        } catch (err) {
            console.error('sms forward failed', err);
        }
    }
    return EMPTY();
}
