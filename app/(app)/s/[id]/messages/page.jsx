import Link from 'next/link';
import { sendText } from 'app/(app)/actions';
import { ActionForm } from 'components/app/action-form';
import { requireSubaccount } from 'lib/auth';
import { isMissingTable, threadsFrom } from 'lib/sms';
import { formatDateTime, formatPhone } from 'lib/stats';

export default async function MessagesPage({ params, searchParams }) {
    const { id } = await params;
    const { phone } = await searchParams;
    const { supabase, subaccount } = await requireSubaccount(id);

    const { data: recent, error } = await supabase.from('messages').select('phone, body, direction, created_at').eq('subaccount_id', id).order('created_at', { ascending: false }).limit(500);
    if (isMissingTable(error)) {
        return (
            <div className="card text-sm text-slate-600">
                Texting needs one database update. In Supabase, open SQL Editor, paste the contents of <code>supabase/migrations/0004_messages.sql</code>, and click Run.
            </div>
        );
    }
    const threads = threadsFrom(recent ?? []);
    const phones = threads.map((t) => t.phone);
    if (phone && !phones.includes(phone)) phones.push(phone);
    const { data: contactRows } = phones.length ? await supabase.from('contacts').select('phone, name').eq('subaccount_id', id).in('phone', phones) : { data: [] };
    const names = Object.fromEntries((contactRows ?? []).filter((c) => c.name).map((c) => [c.phone, c.name]));
    const label = (p) => names[p] || formatPhone(p);

    const { data: thread } = phone
        ? await supabase.from('messages').select('*').eq('subaccount_id', id).eq('phone', phone).order('created_at', { ascending: true }).limit(300)
        : { data: null };

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4">
                <div className="card p-0">
                    <ul className="divide-y divide-slate-100">
                        {threads.map((t) => (
                            <li key={t.phone}>
                                <Link href={`/s/${id}/messages?phone=${encodeURIComponent(t.phone)}`} className={`block px-4 py-3 hover:bg-slate-50 ${t.phone === phone ? 'bg-slate-50' : ''}`}>
                                    <div className="flex justify-between gap-2 text-sm">
                                        <span className="font-medium">{label(t.phone)}</span>
                                        <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(t.created_at, subaccount.timezone)}</span>
                                    </div>
                                    <p className="truncate text-sm text-slate-500">
                                        {t.direction === 'out' ? 'You: ' : ''}
                                        {t.body}
                                    </p>
                                </Link>
                            </li>
                        ))}
                        {!threads.length && <li className="px-4 py-8 text-center text-sm text-slate-500">No texts yet.</li>}
                    </ul>
                </div>
                <div className="card">
                    <h2 className="mb-4 font-semibold">New text</h2>
                    <ActionForm action={sendText.bind(null, id, null)} submitLabel="Send" pendingText="Sending…">
                        <input name="phone" type="tel" placeholder="Phone" required className="field" />
                        <textarea name="body" rows={3} placeholder="Message" required className="field" />
                    </ActionForm>
                </div>
            </div>
            <div className="lg:col-span-2">
                {phone ? (
                    <div className="card space-y-4">
                        <h2 className="font-semibold">{label(phone)}</h2>
                        <ol className="space-y-3">
                            {(thread ?? []).map((m) => (
                                <li key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.direction === 'out' ? 'text-white' : 'bg-slate-100 text-slate-800'}`} style={m.direction === 'out' ? { background: 'var(--brand)' } : undefined}>
                                        <p className="whitespace-pre-wrap">{m.body}</p>
                                        {m.media_urls?.length > 0 && <p className="mt-1 text-xs opacity-70">{m.media_urls.length} attachment(s)</p>}
                                        <p className="mt-1 text-xs opacity-70">{formatDateTime(m.created_at, subaccount.timezone)}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <ActionForm action={sendText.bind(null, id, phone)} submitLabel="Send" pendingText="Sending…">
                            <textarea name="body" rows={3} placeholder="Reply" required className="field" />
                        </ActionForm>
                    </div>
                ) : (
                    <div className="card text-sm text-slate-500">Choose a conversation, or start a new text.</div>
                )}
            </div>
        </div>
    );
}
