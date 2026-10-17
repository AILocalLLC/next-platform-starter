export const metadata = { title: 'Text message consent - New Gutters Near Me' };

// Public page describing how customers opt in to texts (required for carrier/Twilio registration).
export default function SmsConsentPage() {
    return (
        <main className="mx-auto max-w-2xl space-y-5 px-6 py-12 text-slate-800">
            <h1 className="text-2xl font-bold">Text message consent</h1>
            <p className="text-sm text-slate-500">New Gutters Near Me LLC · 751 Lake Avenue Northeast, Massillon, OH 44646 · newguttersnearme.com</p>

            <h2 className="text-lg font-semibold">How customers opt in</h2>
            <p>
                Customers call or text New Gutters Near Me to request a free estimate or service. During the call, our receptionist asks for the
                customer&apos;s name and the best phone number to reach them, and tells them:
            </p>
            <blockquote className="border-l-4 border-slate-300 pl-4 italic">
                &ldquo;We&apos;ll text you a confirmation of your appointment at this number. Message and data rates may apply. You can reply STOP at any
                time to opt out.&rdquo;
            </blockquote>
            <p>Customers who text our number first have opted in by contacting us, and receive replies to their own messages.</p>

            <h2 className="text-lg font-semibold">What we send</h2>
            <ul className="list-disc space-y-1 pl-6">
                <li>Appointment confirmations, for example: &ldquo;Thanks Sam! Your New Gutters Near Me appointment is booked for Wednesday, October 14 at 9:00 AM. Reply STOP to opt out.&rdquo;</li>
                <li>Follow-ups about the customer&apos;s own service request, and replies to their questions.</li>
            </ul>
            <p>No marketing messages. Message frequency varies, usually 1–3 messages per request. Message and data rates may apply.</p>

            <h2 className="text-lg font-semibold">Opt out and help</h2>
            <p>Reply STOP to stop receiving texts, or HELP for help. You can also call us at (330) 919-6167.</p>

            <h2 className="text-lg font-semibold">Privacy</h2>
            <p>
                Mobile numbers and text message consent are never sold or shared with third parties or affiliates for marketing purposes. Phone numbers
                are used only to contact the customer about their own request. See our <a className="underline" href="/privacy">Privacy Policy</a> and{' '}
                <a className="underline" href="/terms">Terms of Service</a>.
            </p>
        </main>
    );
}
