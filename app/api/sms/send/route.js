import twilio from 'twilio';
import { createAdminClient } from 'lib/supabase/admin';
import { automationText, keyMatches } from 'lib/crm';
import { fromIsBusiness, toE164, usDestination } from 'lib/phone';
import { isOptedOut } from 'lib/optOut';

// The CRM's automations call this to send one text from the business's number.
// test: true sends it to the owner's phone instead of the lead.
// Replies: { status: 'sent', sid } or an error status (plus Twilio's errorCode,
// e.g. 21610 when the lead has replied STOP). A lead on our STOP list gets
// 200 { status: 'opted-out', skipped: 'opted_out', errorCode: 21610 }: the CRM
// treats 21610 as Do Not Text and does not retry.
export async function POST(request) {
    if (!keyMatches(request.headers.get('x-lead-alert-key'), process.env.LEAD_ALERT_KEY)) {
        return new Response('Forbidden', { status: 403 });
    }
    let msg;
    try {
        msg = await request.json();
    } catch {
        return Response.json({ status: 'bad-json' }, { status: 400 });
    }
    if ((!msg?.slug && !msg?.from) || !msg?.body || (!msg.test && !msg.to)) {
        return Response.json({ status: 'missing-fields' }, { status: 400 });
    }

    const db = createAdminClient();
    // Find the business by its CRM form, or (for automations not started by a form) by its texting number.
    let subaccount = null;
    if (msg.slug) {
        ({ data: subaccount } = await db.from('subaccounts').select('id, twilio_number, notify_phone').eq('crm_funnel_slug', String(msg.slug)).maybeSingle());
    }
    if (!subaccount && msg.from) {
        const from = toE164(String(msg.from));
        if (from) ({ data: subaccount } = await db.from('subaccounts').select('id, twilio_number, notify_phone').eq('twilio_number', from).maybeSingle());
    }
    if (!subaccount) return Response.json({ status: 'no-business' }, { status: 404 });
    // A from number must be this business's own texting number.
    if (!fromIsBusiness(subaccount, msg.from)) return Response.json({ status: 'from-not-allowed' }, { status: 403 });
    if (!subaccount.twilio_number || !process.env.TWILIO_ACCOUNT_SID) return Response.json({ status: 'no-number' }, { status: 409 });

    // US/Canada only, owner test texts included.
    const to = usDestination(msg.test ? subaccount.notify_phone : String(msg.to), 'automation text');
    if (!to) return Response.json({ status: msg.test ? 'no-owner-phone' : 'bad-number' }, { status: 409 });
    if (!msg.test) {
        try {
            if (await isOptedOut(db, subaccount.id, to)) return Response.json({ status: 'opted-out', skipped: 'opted_out', errorCode: 21610 });
        } catch (err) {
            console.error('automation SMS', err.message);
            return Response.json({ status: 'opt-out-check-failed' }, { status: 503 });
        }
    }

    try {
        const sms = await twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).messages.create({
            from: subaccount.twilio_number,
            to,
            body: automationText({ body: msg.body, test: Boolean(msg.test), contactName: msg.contactName, to: msg.to })
        });
        return Response.json({ status: 'sent', sid: sms.sid });
    } catch (err) {
        console.error('automation SMS failed', err?.code, err?.message);
        return Response.json({ status: 'sms-failed', errorCode: err?.code ?? null }, { status: 502 });
    }
}
