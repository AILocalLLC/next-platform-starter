import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSubaccount } from 'lib/auth';
import { formatDateTime, formatPhone } from 'lib/stats';

export default async function CallDetailPage({ params }) {
    const { id, callId } = await params;
    const { supabase, subaccount } = await requireSubaccount(id);
    const { data: call } = await supabase
        .from('calls')
        .select('id, started_at, from_number, status, summary, transcript, lead_captured, duration_seconds, contacts(id, name, phone, email, notes)')
        .eq('id', callId)
        .eq('subaccount_id', id)
        .maybeSingle();
    if (!call) notFound();

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
                <Link href={`/s/${id}/calls`} className="link text-sm">
                    ← All calls
                </Link>
                <div className="card">
                    <h2 className="mb-4 font-semibold">Transcript</h2>
                    <ol className="space-y-3">
                        {(call.transcript || []).map((t, i) => (
                            <li key={i} className={`flex ${t.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${t.role === 'ai' ? 'bg-slate-100 text-slate-800' : 'text-white'}`} style={t.role === 'ai' ? undefined : { background: 'var(--brand)' }}>
                                    <p className="mb-0.5 text-xs opacity-70">{t.role === 'ai' ? 'AI receptionist' : 'Caller'}</p>
                                    {t.text}
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
            <div className="space-y-4">
                <div className="card space-y-2 text-sm">
                    <h2 className="font-semibold">Call details</h2>
                    <p>
                        <span className="text-slate-500">When:</span> {formatDateTime(call.started_at, subaccount.timezone)}
                    </p>
                    <p>
                        <span className="text-slate-500">Caller:</span> {formatPhone(call.from_number)}
                    </p>
                    <p>
                        <span className="text-slate-500">Status:</span> {call.status}
                    </p>
                    {call.duration_seconds != null && (
                        <p>
                            <span className="text-slate-500">Length:</span> {Math.round(call.duration_seconds / 6) / 10} min
                        </p>
                    )}
                    {call.summary && <p className="border-t border-slate-100 pt-2 text-slate-700">{call.summary}</p>}
                </div>
                {call.contacts && (
                    <div className="card space-y-1 text-sm">
                        <h2 className="mb-1 font-semibold">Lead captured</h2>
                        <p className="font-medium">{call.contacts.name}</p>
                        <p>{formatPhone(call.contacts.phone)}</p>
                        {call.contacts.email && <p>{call.contacts.email}</p>}
                        {call.contacts.notes && <p className="whitespace-pre-line text-slate-600">{call.contacts.notes}</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
