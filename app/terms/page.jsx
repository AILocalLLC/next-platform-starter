export const metadata = { title: 'Terms of Service - New Gutters Near Me' };

export default function TermsPage() {
    return (
        <main className="mx-auto max-w-2xl space-y-4 px-6 py-12 text-slate-800">
            <h1 className="text-2xl font-bold">Terms of Service</h1>
            <p className="text-sm text-slate-500">New Gutters Near Me LLC · Massillon, OH · Effective October 7, 2026</p>

            <h2 className="text-lg font-semibold">SMS program</h2>
            <ul className="list-disc space-y-1 pl-6">
                <li><strong>Program:</strong> New Gutters Near Me customer care texts about your estimate or service request: appointment confirmations, follow-ups, and replies to your questions. We do not send marketing messages.</li>
                <li><strong>Consent:</strong> You opt in by giving us your mobile number when you call or text us to request service. Consent is not a condition of purchase.</li>
                <li><strong>Frequency:</strong> Message frequency varies, usually 1–3 messages per request.</li>
                <li><strong>Cost:</strong> Message and data rates may apply.</li>
                <li><strong>Opt out:</strong> Reply STOP at any time to stop receiving texts. You will receive one confirmation and no further messages.</li>
                <li><strong>Help:</strong> Reply HELP, or call (330) 919-6167.</li>
                <li><strong>Carriers</strong> are not liable for delayed or undelivered messages.</li>
            </ul>

            <h2 className="text-lg font-semibold">Privacy</h2>
            <p>See our <a className="underline" href="/privacy">Privacy Policy</a>. No mobile information is shared with third parties or affiliates for marketing or promotional purposes.</p>
        </main>
    );
}
