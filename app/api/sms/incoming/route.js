import twilio from 'twilio';
import { createAdminClient } from 'lib/supabase/admin';
import { findOrCreateContact, forwardText, isMissingTable, mediaUrls } from 'lib/sms';
import { forbidden, readTwilioRequest } from 'lib/voice';

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

    let contact = null;
    if (!fromOwner) {
        try {
            contact = await findOrCreateContact(db, subaccount.id, phone);
        } catch (err) {
            console.error('sms contact failed', err);
        }
    }

    const { error } = await db.from('messages').upsert(
        { subaccount_id: subaccount.id, contact_id: contact?.id ?? null, direction: 'in', phone, body, media_urls: media, twilio_sid: params.MessageSid, status: 'received' },
        { onConflict: 'twilio_sid', ignoreDuplicates: true }
    );
    if (error && !isMissingTable(error)) console.error('sms save failed', error);

    // Owner's own texts to the business line are not forwarded back to them.
    if (!fromOwner && subaccount.notify_phone && process.env.TWILIO_ACCOUNT_SID) {
        try {
            await twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).messages.create({
                from: subaccount.twilio_number,
                to: subaccount.notify_phone,
                body: forwardText(subaccount, { name: contact?.name, phone, body, media })
            });
        } catch (err) {
            console.error('sms forward failed', err);
        }
    }
    return EMPTY();
}
