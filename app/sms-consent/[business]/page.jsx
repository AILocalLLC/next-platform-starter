import { notFound } from 'next/navigation';
import { CONSENT_LINE, SMS_CONSENT } from '../../../lib/smsConsent.js';

export function generateStaticParams() {
    return Object.keys(SMS_CONSENT).map((business) => ({ business }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }) {
    const b = SMS_CONSENT[(await params).business];
    return { title: b ? `Text message consent - ${b.name}` : 'Text message consent' };
}

// Public page describing how customers opt in to texts (required for carrier/Twilio registration).
export default async function BusinessSmsConsentPage({ params }) {
    const b = SMS_CONSENT[(await params).business];
    if (!b) notFound();
    return (
        <main className="mx-auto max-w-2xl space-y-5 px-6 py-12 text-slate-800">
            <h1 className="text-2xl font-bold">Text message consent</h1>
            <p className="text-sm text-slate-500">{b.legalName} · {b.address} · {b.website}</p>

            <h2 className="text-lg font-semibold">How customers opt in</h2>
            <p>
                Customers call or text {b.name} at {b.phone} to {b.request}, {b.web}. During the call, our receptionist asks for the customer&apos;s
                name and the best phone number to reach them, and tells them:
            </p>
            <blockquote className="border-l-4 border-slate-300 pl-4 italic">&ldquo;{CONSENT_LINE}&rdquo;</blockquote>
            <p>Customers who text our number first have opted in by contacting us, and receive replies to their own messages. Consent is not a condition of purchase.</p>

            <h2 className="text-lg font-semibold">What we send</h2>
            <ul className="list-disc space-y-1 pl-6">
                <li>Appointment confirmations, for example: &ldquo;{b.sample}&rdquo;</li>
                <li>Follow-ups about the customer&apos;s own request, and replies to their questions.</li>
            </ul>
            <p>No marketing messages. Message frequency varies, usually 1–3 messages per request. Message and data rates may apply.</p>

            <h2 className="text-lg font-semibold">Opt out and help</h2>
            <p>Reply STOP to stop receiving texts, or HELP for help. You can also call us at {b.phone}.</p>

            <h2 className="text-lg font-semibold">Privacy</h2>
            <p>
                Mobile numbers and text message consent are never sold or shared with third parties or affiliates for marketing purposes. Phone numbers
                are used only to contact the customer about their own request. See our <a className="underline" href={b.privacyUrl}>Privacy Policy</a> and{' '}
                <a className="underline" href={b.termsUrl}>Terms of Service</a>.
            </p>
        </main>
    );
}
