import Link from 'next/link';
import { CallsTable } from 'components/app/calls-table';
import { requireSubaccount } from 'lib/auth';

const PAGE = 50;

export default async function CallsPage({ params, searchParams }) {
    const { id } = await params;
    const { page: pageParam, leads } = await searchParams;
    const page = Math.max(1, Number(pageParam) || 1);
    const { supabase, subaccount } = await requireSubaccount(id);
    let query = supabase
        .from('calls')
        .select('id, channel, started_at, ended_at, from_number, summary, lead_captured, duration_seconds')
        .eq('subaccount_id', id)
        .order('started_at', { ascending: false })
        .range((page - 1) * PAGE, page * PAGE);
    if (leads) query = query.eq('lead_captured', true);
    const { data } = await query;
    const calls = data ?? [];
    const base = `/s/${id}/calls?${leads ? 'leads=1&' : ''}`;

    return (
        <div className="space-y-4">
            <div className="flex gap-2 text-sm">
                <Link href={`/s/${id}/calls`} className={leads ? 'btn-ghost-sm' : 'btn-brand py-1.5'}>
                    All calls
                </Link>
                <Link href={`/s/${id}/calls?leads=1`} className={leads ? 'btn-brand py-1.5' : 'btn-ghost-sm'}>
                    Leads only
                </Link>
            </div>
            <CallsTable calls={calls.slice(0, PAGE)} subaccountId={id} timeZone={subaccount.timezone} />
            <div className="flex justify-between text-sm">
                {page > 1 ? (
                    <Link href={`${base}page=${page - 1}`} className="link">
                        ← Newer
                    </Link>
                ) : (
                    <span />
                )}
                {calls.length > PAGE && (
                    <Link href={`${base}page=${page + 1}`} className="link">
                        Older →
                    </Link>
                )}
            </div>
        </div>
    );
}
