import twilio from 'twilio';
import { createAdminClient } from 'lib/supabase/admin';
import { keyMatches, leadAlertText } from 'lib/crm';

// The CRM calls this for every new lead it receives (website form, referrals).
// We text the business owner from the business's own number.
export async function POST(request) {
    if (!keyMatches(request.headers.get('x-lead-alert-key'), process.env.LEAD_ALERT_KEY)) {
        return new Response('Forbidden', { status: 403 });
    }
    let lead;
    try {
        lead = await request.json();
    } catch {
        return Response.json({ error: 'Bad JSON' }, { status: 400 });
    }
    if (!lead?.slug) return Response.json({ error: 'Missing slug' }, { status: 400 });

    const db = createAdminClient();
    const { data: subaccount } = await db.from('subaccounts').select('twilio_number, notify_phone').eq('crm_funnel_slug', String(lead.slug)).maybeSingle();
    if (!subaccount) return Response.json({ status: 'no-business' }, { status: 404 });
    if (!subaccount.notify_phone || !subaccount.twilio_number || !process.env.TWILIO_ACCOUNT_SID) {
        return Response.json({ status: 'no-alert-number' });
    }
    try {
        await twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN).messages.create({
            from: subaccount.twilio_number,
            to: subaccount.notify_phone,
            body: leadAlertText(lead)
        });
    } catch (err) {
        console.error('lead alert SMS failed', err);
        return Response.json({ status: 'sms-failed' }, { status: 502 });
    }
    return Response.json({ status: 'sent' });
}
